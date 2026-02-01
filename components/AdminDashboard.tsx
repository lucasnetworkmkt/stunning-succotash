import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Settings, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Copy,
  Database,
  AlertTriangle,
  Server,
  Megaphone,
  UtensilsCrossed,
  Save,
  Edit2,
  X,
  RefreshCw,
  Plus,
  ShoppingBag,
  ChefHat,
  ArrowRight,
  ShieldAlert,
  Utensils,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { Reservation, Announcement, Order, OrderItem } from '../types';
import { fetchAnnouncements, createAnnouncement, toggleAnnouncement, resetMenuToDefaults, fetchOrders, updateOrderStatus, checkSchemaTables } from '../services/supabase';

interface AdminDashboardProps {
  reservations: Reservation[];
  menuItems: any[];
  onUpdateStatus: (id: string, status: 'confirmed' | 'cancelled') => void;
  onUpdateMenuPrice: (id: string, newPrice: number) => void;
  onAddMenuItem: (item: any) => Promise<void>;
  onLogout: () => void;
  isDbConnected: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ reservations, menuItems, onUpdateStatus, onUpdateMenuPrice, onAddMenuItem, onLogout, isDbConnected }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'reservations' | 'menu' | 'settings'>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  
  // Announcement State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);

  // Orders State (Kitchen Display)
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Schema Validation State
  const [isSchemaValid, setIsSchemaValid] = useState(true);

  // Menu Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [isResettingMenu, setIsResettingMenu] = useState(false);

  // Add Item State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'carnes',
    image: '',
    highlight: false
  });

  // Verify DB Schema on mount
  useEffect(() => {
    if (isDbConnected) {
      checkSchemaTables().then(isValid => setIsSchemaValid(isValid));
    }
  }, [isDbConnected]);

  // Load Orders when needed (Orders tab, Overview tab, OR Reservations tab to show pre-orders)
  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'overview' || activeTab === 'reservations') {
      setIsLoadingOrders(true);
      fetchOrders().then(data => {
        setOrders(data);
        setIsLoadingOrders(false);
      });
      // Setup polling for new orders every 15s if connected
      const interval = setInterval(() => {
        if(isDbConnected) {
          fetchOrders().then(setOrders);
        }
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isDbConnected]);

  // --- DATA SANITIZATION (CRITICAL FOR STABILITY) ---
  const cleanReservations = useMemo(() => {
    if (!Array.isArray(reservations)) return [];
    return reservations.filter(r => r && typeof r === 'object' && r.id);
  }, [reservations]);

  const cleanMenuItems = useMemo(() => {
    if (!Array.isArray(menuItems)) return [];
    return menuItems.filter(i => i && typeof i === 'object' && i.id);
  }, [menuItems]);

  // --- FINANCIAL CALCULATION LOGIC ---
  const financialStats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Last Month Calculation
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let currentRevenue = 0;
    let lastMonthRevenue = 0;
    
    // Array for daily revenue chart (indices 0-30 representing days 1-31)
    const dailyRevenue = new Array(31).fill(0);

    orders.forEach(order => {
      // Ignore cancelled orders
      if (order.status === 'cancelled') return;

      const orderDate = new Date(order.createdAt);
      const orderTotal = Number(order.total) || 0;

      // Check for Current Month
      if (orderDate.getMonth() === thisMonth && orderDate.getFullYear() === thisYear) {
        currentRevenue += orderTotal;
        
        // Add to Daily Chart
        const day = orderDate.getDate() - 1; // 0-indexed for array
        if (dailyRevenue[day] !== undefined) {
          dailyRevenue[day] += orderTotal;
        }
      } 
      // Check for Last Month
      else if (orderDate.getMonth() === lastMonth && orderDate.getFullYear() === lastMonthYear) {
        lastMonthRevenue += orderTotal;
      }
    });

    // Calculate Growth Percentage
    let percentageChange = 0;
    if (lastMonthRevenue > 0) {
      percentageChange = ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (currentRevenue > 0) {
      percentageChange = 100; // 100% growth if started from 0
    }

    // Find max value for chart scaling
    const maxDailyRevenue = Math.max(...dailyRevenue, 1); // Avoid div by zero

    return { 
      currentRevenue, 
      lastMonthRevenue, 
      percentageChange, 
      dailyRevenue,
      maxDailyRevenue
    };
  }, [orders]);

  // SQL Command Generation
  const sqlCommand = useMemo(() => {
    return `-- COMANDO DE RECUPERAÇÃO E POPULAÇÃO (V4 - Traduzido)
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- 1. ESTRUTURA DE DADOS
create table reservations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_name text,
  phone text,
  pax int,
  date text,
  time text,
  table_type text,
  status text default 'confirmed'
);

create table announcements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  message text,
  is_active boolean default true
);

create table menu_items (
  id text primary key,
  name text,
  description text,
  price numeric,
  category text,
  highlight boolean,
  image text
);

create table orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_name text,
  client_phone text,
  total numeric,
  status text default 'pending_payment',
  payment_id text
);

create table order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade,
  menu_item_id text,
  name text,
  quantity int,
  price numeric
);

-- 2. SEGURANÇA (RLS)
alter table reservations enable row level security;
alter table announcements enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "Public Access" on reservations for all using (true) with check (true);
create policy "Public Access" on announcements for all using (true) with check (true);
create policy "Public Access" on menu_items for all using (true) with check (true);
create policy "Public Access" on orders for all using (true) with check (true);
create policy "Public Access" on order_items for all using (true) with check (true);

-- 3. POPULAR CARDÁPIO (DADOS INICIAIS TRADUZIDOS)
INSERT INTO menu_items (id, name, description, price, category, highlight, image) VALUES
('1', 'Tomahawk Prime Ouro', 'Corte nobre de 800g com osso, finalizado na manteiga de ervas e flor de sal.', 189.90, 'carnes', true, 'https://images.unsplash.com/photo-1615937691194-97dbd3f3dc29?auto=format&fit=crop&q=80&w=800'),
('2', 'Bife de Chorizo Angus', 'Suculência extrema, grelhado ao ponto do chef. Acompanha batatas rústicas.', 89.90, 'carnes', true, 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&q=80&w=800'),
('3', 'Costela Defumada BBQ', 'Assada lentamente por 12 horas, desmancha no garfo. Molho barbecue artesanal.', 75.00, 'carnes', false, 'https://i.ibb.co/HpdPgmyb/Captura-de-tela-2026-02-01-121212.png'),
('4', 'Ancho Premium', 'Corte dianteiro do contrafilé, marmoreio intenso e sabor inigualável.', 92.00, 'carnes', false, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&q=80&w=800'),
('5', 'Nhoque ao Funghi Trufado', 'Massa fresca de batata, molho cremoso de cogumelos selvagens e azeite trufado.', 68.00, 'massas', true, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800'),
('9', 'Burrata Caprese', 'Burrata cremosa, tomates confit, pesto de manjericão fresco e torradas.', 55.00, 'entradas', true, 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=800'),
('13', 'Vulcão de Doce de Leche', 'Petit gateau de doce de leite argentino com sorvete de baunilha.', 32.00, 'sobremesas', true, 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&q=80&w=800'),
('16', 'Malbec Reserva', 'Vinho tinto encorpado, notas de ameixa e baunilha. Safra especial.', 140.00, 'vinhos', false, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800');
`;
  }, []);

  // Load Announcements
  useEffect(() => {
    if (activeTab === 'settings') {
      fetchAnnouncements().then(data => {
        if(Array.isArray(data)) setAnnouncements(data);
      });
    }
  }, [activeTab]);

  // Safe Stats
  const stats = {
    total: cleanReservations.length,
    pending: cleanReservations.filter(r => r.status === 'pending').length,
    confirmed: cleanReservations.filter(r => r.status === 'confirmed').length,
    todayOrders: orders.filter(o => {
        try { return new Date(o.createdAt).toDateString() === new Date().toDateString(); } catch(e) { return false; }
    }).length,
    pendingOrders: orders.filter(o => o.status === 'paid' || o.status === 'preparing').length
  };

  const filteredReservations = cleanReservations
    .filter(r => filterStatus === 'all' || r.status === filterStatus)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const copySql = () => {
    navigator.clipboard.writeText(sqlCommand);
    alert("SQL copiado!");
  };

  const handlePostAnnouncement = async () => {
    if (!newAnnouncementText.trim()) return;
    setIsPostingAnnouncement(true);
    try {
      const newItem = await createAnnouncement(newAnnouncementText);
      if (newItem) {
        setAnnouncements(prev => [newItem, ...prev]); 
        setNewAnnouncementText('');
      }
    } catch(e) {}
    setIsPostingAnnouncement(false);
  };

  const handleToggleAnnouncement = async (id: string, currentStatus: boolean) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, isActive: !currentStatus } : a));
    await toggleAnnouncement(id, !currentStatus);
    const fresh = await fetchAnnouncements();
    if(Array.isArray(fresh)) setAnnouncements(fresh);
  };

  const startEditingPrice = (item: any) => {
    if (!item) return;
    setEditingPriceId(item.id);
    const val = item.price !== undefined && item.price !== null ? item.price : 0;
    setTempPrice(String(val));
  };

  const savePrice = (id: string) => {
    const newPrice = parseFloat(tempPrice);
    if (!isNaN(newPrice) && newPrice >= 0) {
      onUpdateMenuPrice(id, newPrice);
      setEditingPriceId(null);
    }
  };

  const formatPrice = (p: any) => {
    const num = parseFloat(p);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const handleResetMenu = async () => {
    if (confirm("Resetar cardápio para o padrão?")) {
      setIsResettingMenu(true);
      try {
        await resetMenuToDefaults();
        window.location.reload();
      } catch (e) {
        alert("Erro ao resetar.");
      } finally {
        setIsResettingMenu(false);
      }
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.name || !newItemData.price) return;
    
    await onAddMenuItem({
      name: newItemData.name,
      description: newItemData.description,
      price: parseFloat(newItemData.price),
      category: newItemData.category,
      image: newItemData.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
      popular: newItemData.highlight
    });
    
    setShowAddForm(false);
    setNewItemData({ name: '', description: '', price: '', category: 'carnes', image: '', highlight: false });
  };

  const handleOrderStatus = async (id: string, newStatus: string) => {
    await updateOrderStatus(id, newStatus);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus as any } : o));
  };

  // Logic to find a matching pre-order for a reservation
  // Matches by Name and Creation Time (within 10 minutes)
  const getLinkedOrderItems = (res: Reservation): OrderItem[] => {
    const tenMinutes = 600000;
    const match = orders.find(o => 
      o.clientName.toLowerCase().trim() === res.clientName.toLowerCase().trim() && 
      Math.abs(o.createdAt - res.createdAt) < tenMinutes
    );
    return match ? match.items : [];
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans flex animate-in fade-in duration-500">
      
      {/* Sidebar */}
      <aside className="w-64 bg-stone-900 border-r border-stone-800 flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="p-6 border-b border-stone-800">
          <h1 className="font-serif text-2xl font-bold text-white tracking-widest">FUEGO<span className="text-orange-600">.OS</span></h1>
          <p className="text-xs text-stone-500 uppercase tracking-widest mt-1">Painel Gestor</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-orange-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Visão Geral</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-orange-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <ChefHat size={20} />
            <span className="font-medium">Cozinha (KDS)</span>
            {stats.pendingOrders > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{stats.pendingOrders}</span>}
          </button>

          <button 
            onClick={() => setActiveTab('reservations')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reservations' ? 'bg-orange-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <CalendarDays size={20} />
            <span className="font-medium">Reservas</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('menu')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'menu' ? 'bg-orange-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <UtensilsCrossed size={20} />
            <span className="font-medium">Cardápio</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <Settings size={20} />
            <span className="font-medium">Configurações</span>
             {!isSchemaValid && <ShieldAlert size={16} className="text-red-500 ml-auto animate-pulse" />}
          </button>
        </nav>

        <div className="p-4 border-t border-stone-800">
           <div className={`mb-4 rounded-xl p-3 border ${isDbConnected ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'}`}>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                 <span className="text-xs font-bold text-white">
                   {isDbConnected ? 'Online' : 'Offline'}
                 </span>
              </div>
           </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-stone-400 hover:bg-red-900/20 hover:text-red-400">
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-serif font-bold text-white capitalize">
             {activeTab === 'orders' ? 'Monitor de Pedidos' : activeTab === 'overview' ? 'Visão Geral' : activeTab === 'reservations' ? 'Gestão de Reservas' : activeTab === 'menu' ? 'Gestão de Cardápio' : 'Configurações do Sistema'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center">
              <Users size={20} className="text-stone-400" />
            </div>
          </div>
        </header>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800">
                <p className="text-stone-500 text-sm">Pedidos Hoje</p>
                <h3 className="text-3xl font-bold text-white">{stats.todayOrders}</h3>
              </div>
              <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800">
                <p className="text-stone-500 text-sm">Pedidos na Fila</p>
                <h3 className="text-3xl font-bold text-orange-500">{stats.pendingOrders}</h3>
              </div>
              <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800">
                <p className="text-stone-500 text-sm">Reservas Confirmadas</p>
                <h3 className="text-3xl font-bold text-white">{stats.confirmed}</h3>
              </div>
              <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800">
                <p className="text-stone-500 text-sm">Total Reservas</p>
                <h3 className="text-3xl font-bold text-white">{stats.total}</h3>
              </div>
            </div>

            {/* FINANCIAL REPORT SECTION */}
            <div className="bg-stone-900 rounded-2xl border border-stone-800 p-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h3 className="font-bold text-white text-xl flex items-center gap-2">
                      <DollarSign className="text-emerald-500" size={24} />
                      Relatório Financeiro (Online)
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">Receita baseada exclusivamente em pré-pedidos do site (cancelamentos excluídos).</p>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${financialStats.percentageChange >= 0 ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                     {financialStats.percentageChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                     <span className="font-bold text-lg">{Math.abs(financialStats.percentageChange).toFixed(1)}%</span>
                     <span className="text-xs opacity-70">vs mês anterior</span>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Stats Cards */}
                  <div className="col-span-1 space-y-4">
                     <div className="bg-stone-950 p-6 rounded-xl border border-stone-800">
                        <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Faturamento Atual (Mês)</p>
                        <h4 className="text-4xl font-serif font-bold text-white">R$ {financialStats.currentRevenue.toFixed(2)}</h4>
                     </div>
                     <div className="bg-stone-950 p-6 rounded-xl border border-stone-800 opacity-70">
                        <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Faturamento Mês Anterior</p>
                        <h4 className="text-2xl font-serif font-bold text-stone-300">R$ {financialStats.lastMonthRevenue.toFixed(2)}</h4>
                     </div>
                  </div>

                  {/* Simple Bar Chart */}
                  <div className="col-span-1 lg:col-span-2 bg-stone-950 p-6 rounded-xl border border-stone-800 flex flex-col justify-end min-h-[250px]">
                     <div className="flex justify-between items-end mb-4 h-full gap-1">
                        {financialStats.dailyRevenue.map((val, idx) => {
                           const heightPercentage = Math.max((val / financialStats.maxDailyRevenue) * 100, 2); // Min 2% height
                           return (
                             <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative">
                                <div 
                                  className={`w-full max-w-[12px] rounded-t-sm transition-all duration-500 ${val > 0 ? 'bg-orange-600 hover:bg-orange-500' : 'bg-stone-800'}`}
                                  style={{ height: `${heightPercentage}%` }}
                                ></div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 bg-white text-stone-950 text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                   Dia {idx + 1}: R$ {val.toFixed(0)}
                                </div>
                             </div>
                           );
                        })}
                     </div>
                     <div className="flex justify-between text-[10px] text-stone-600 border-t border-stone-800 pt-2">
                        <span>Dia 1</span>
                        <span>Dia 15</span>
                        <span>Dia 30</span>
                     </div>
                     <p className="text-center text-xs text-stone-500 mt-2 flex items-center justify-center gap-2">
                       <BarChart3 size={12} />
                       Receita Diária (Mês Atual)
                     </p>
                  </div>
               </div>
            </div>
             
             {!isSchemaValid && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-6 flex items-start gap-4">
                   <ShieldAlert size={32} className="text-red-500 shrink-0" />
                   <div>
                      <h4 className="text-xl font-bold text-white mb-2">Atenção: Atualização Necessária</h4>
                      <p className="text-stone-300 text-sm mb-4">
                        O sistema detectou que o seu Banco de Dados está desatualizado. A nova funcionalidade de 
                        <b> Pedidos Online (Checkout)</b> não funcionará até que você rode o novo SQL.
                      </p>
                      <button onClick={() => setActiveTab('settings')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                        Ir para Configurações e Atualizar
                      </button>
                   </div>
                </div>
             )}
          </div>
        )}

        {/* ORDERS (KDS) */}
        {activeTab === 'orders' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.length === 0 && <p className="col-span-full text-stone-500 text-center py-10">Nenhum pedido na fila.</p>}
              
              {orders.map(order => (
                 <div key={order.id} className={`flex flex-col rounded-2xl border p-5 transition-all ${order.status === 'ready' ? 'bg-emerald-900/10 border-emerald-800' : 'bg-stone-900 border-stone-800'}`}>
                    <div className="flex justify-between items-start mb-4 border-b border-stone-800 pb-3">
                       <div>
                          <h4 className="font-bold text-white text-lg">#{order.id.slice(0,4)}</h4>
                          <p className="text-stone-400 text-xs">{new Date(order.createdAt).toLocaleTimeString()} • {order.clientName}</p>
                       </div>
                       <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'paid' ? 'bg-orange-600 text-white' : 
                          order.status === 'preparing' ? 'bg-blue-600 text-white' :
                          order.status === 'ready' ? 'bg-emerald-600 text-white' : 
                          'bg-stone-800 text-stone-500'
                       }`}>
                          {order.status === 'pending_payment' ? 'Aguardando Pgto' :
                           order.status === 'paid' ? 'Novo' :
                           order.status === 'preparing' ? 'Preparando' :
                           order.status === 'ready' ? 'Pronto' : order.status}
                       </div>
                    </div>
                    
                    <div className="flex-1 space-y-2 mb-4">
                       {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-white bg-stone-800 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                                   {item.quantity}
                                </span>
                                <span className="text-stone-300">{item.name}</span>
                             </div>
                          </div>
                       ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-stone-800">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-xs text-stone-500">Total</span>
                           <span className="font-bold text-white">R$ {order.total.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           {order.status === 'paid' && (
                              <button onClick={() => handleOrderStatus(order.id, 'preparing')} className="col-span-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
                                 Iniciar Preparo
                              </button>
                           )}
                           {order.status === 'preparing' && (
                              <button onClick={() => handleOrderStatus(order.id, 'ready')} className="col-span-2 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                                 Pronto para Servir
                              </button>
                           )}
                           {order.status === 'ready' && (
                              <button onClick={() => handleOrderStatus(order.id, 'delivered')} className="col-span-2 bg-stone-800 text-stone-400 py-2 rounded-lg text-sm font-bold hover:bg-stone-700">
                                 Arquivar (Entregue)
                              </button>
                           )}
                           {order.status === 'pending_payment' && (
                              <button onClick={() => handleOrderStatus(order.id, 'paid')} className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-700">
                                 Confirmar Pgto Manual
                              </button>
                           )}
                        </div>
                    </div>
                 </div>
              ))}
           </div>
        )}

        {/* RESERVATIONS */}
        {activeTab === 'reservations' && (
          <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
             <div className="p-6">
               <div className="flex gap-2 mb-4">
                 {['all', 'pending', 'confirmed', 'cancelled'].map(status => (
                   <button 
                    key={status}
                    onClick={() => setFilterStatus(status as any)}
                    className={`px-3 py-1 rounded text-xs uppercase font-bold ${filterStatus === status ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400'}`}
                   >
                     {status === 'all' ? 'Todas' : status === 'pending' ? 'Pendentes' : status === 'confirmed' ? 'Confirmadas' : 'Canceladas'}
                   </button>
                 ))}
               </div>
               {filteredReservations.length === 0 && (
                 <p className="text-stone-500 text-center py-8">Nenhuma reserva encontrada.</p>
               )}
               {filteredReservations.map(res => {
                  const linkedItems = getLinkedOrderItems(res);
                  return (
                    <div key={res.id} className="p-4 border-b border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Client Info */}
                      <div className="min-w-[200px]">
                        <p className="font-bold text-white text-lg">{res.clientName || 'Cliente'}</p>
                        <p className="text-xs text-stone-500">{res.date} • {res.time} • {res.pax}</p>
                        <span className={`text-[10px] uppercase font-bold mt-1 inline-block ${res.status === 'confirmed' ? 'text-emerald-500' : res.status === 'pending' ? 'text-amber-500' : 'text-red-500'}`}>
                          {res.status === 'pending' ? 'Pendente' : res.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                        </span>
                      </div>

                      {/* Middle: Linked Pre-Order Items */}
                      {linkedItems.length > 0 && (
                        <div className="flex-1 bg-stone-950/50 p-3 rounded-lg border border-stone-800/50 w-full sm:w-auto">
                           <div className="flex items-center gap-2 mb-2">
                             <Utensils size={14} className="text-orange-500" />
                             <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">Pré-Pedido</span>
                           </div>
                           <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {linkedItems.map((item, idx) => (
                                <div key={idx} className="text-sm text-stone-300 flex items-center gap-1">
                                  <span className="font-bold text-white">{item.quantity}x</span> {item.name}
                                </div>
                              ))}
                           </div>
                        </div>
                      )}

                      {/* Right: Actions */}
                      <div className="flex gap-2 shrink-0 self-end sm:self-center">
                         {res.status === 'pending' && (
                           <>
                             <button onClick={() => onUpdateStatus(res.id, 'confirmed')} className="p-2 bg-emerald-500/20 text-emerald-500 rounded hover:bg-emerald-500/30 transition-colors" title="Confirmar"><CheckCircle size={18}/></button>
                             <button onClick={() => onUpdateStatus(res.id, 'cancelled')} className="p-2 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors" title="Cancelar"><XCircle size={18}/></button>
                           </>
                         )}
                         {res.status === 'confirmed' && (
                             <button onClick={() => onUpdateStatus(res.id, 'cancelled')} className="p-2 bg-stone-800 text-stone-500 rounded hover:text-red-500 transition-colors" title="Cancelar"><XCircle size={18}/></button>
                         )}
                      </div>
                    </div>
                  );
               })}
             </div>
          </div>
        )}

        {/* MENU TAB - NEW ADD FEATURE */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
             {/* ADD ITEM CARD */}
             <div className="bg-stone-900 rounded-2xl border border-stone-800 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed size={18} className="text-orange-500" />
                    Gerenciar Cardápio
                  </h3>
                  <div className="flex gap-4">
                     <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-orange-700 transition-all">
                       <Plus size={16} /> Novo Prato
                     </button>
                     <button onClick={handleResetMenu} className="text-xs text-red-400 underline hover:text-red-300">
                       Resetar Tabela
                     </button>
                  </div>
                </div>

                {showAddForm && (
                  <form onSubmit={handleCreateItem} className="bg-stone-950 p-6 rounded-xl border border-stone-800 mb-6 animate-in slide-in-from-top-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1">
                          <label className="text-xs text-stone-500 uppercase font-bold">Nome do Prato</label>
                          <input 
                            required 
                            className="w-full bg-stone-900 border border-stone-800 p-2 rounded text-white"
                            value={newItemData.name}
                            onChange={e => setNewItemData({...newItemData, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-stone-500 uppercase font-bold">Preço (R$)</label>
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            className="w-full bg-stone-900 border border-stone-800 p-2 rounded text-white"
                            value={newItemData.price}
                            onChange={e => setNewItemData({...newItemData, price: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-stone-500 uppercase font-bold">Categoria</label>
                          <select 
                            className="w-full bg-stone-900 border border-stone-800 p-2 rounded text-white"
                            value={newItemData.category}
                            onChange={e => setNewItemData({...newItemData, category: e.target.value})}
                          >
                             <option value="carnes">Carnes Nobres</option>
                             <option value="massas">Massas Artesanais</option>
                             <option value="entradas">Entradas</option>
                             <option value="sobremesas">Sobremesas</option>
                             <option value="vinhos">Vinhos & Drinks</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-stone-500 uppercase font-bold">URL da Imagem</label>
                          <input 
                            placeholder="https://..." 
                            className="w-full bg-stone-900 border border-stone-800 p-2 rounded text-white"
                            value={newItemData.image}
                            onChange={e => setNewItemData({...newItemData, image: e.target.value})}
                          />
                        </div>
                        <div className="col-span-full space-y-1">
                          <label className="text-xs text-stone-500 uppercase font-bold">Descrição</label>
                          <textarea 
                            className="w-full bg-stone-900 border border-stone-800 p-2 rounded text-white h-20 resize-none"
                            value={newItemData.description}
                            onChange={e => setNewItemData({...newItemData, description: e.target.value})}
                          />
                        </div>
                        <div className="col-span-full flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="highlight"
                            className="w-4 h-4 accent-orange-500"
                            checked={newItemData.highlight}
                            onChange={e => setNewItemData({...newItemData, highlight: e.target.checked})}
                          />
                          <label htmlFor="highlight" className="text-sm text-white">Destacar este item (Aparecerá em "Destaques")</label>
                        </div>
                     </div>
                     <div className="flex gap-3">
                       <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Salvar Prato</button>
                       <button type="button" onClick={() => setShowAddForm(false)} className="bg-stone-800 hover:bg-stone-700 text-white py-2 px-4 rounded-lg transition-colors">Cancelar</button>
                     </div>
                  </form>
                )}
             
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cleanMenuItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-stone-950 p-3 rounded border border-stone-800 hover:border-orange-900/30 transition-colors">
                        <div className="flex items-center gap-3">
                          {item.image && <img src={item.image} className="w-10 h-10 rounded object-cover bg-stone-900" alt="" />}
                          <div>
                            <p className="font-bold text-sm text-white">{item.name}</p>
                            <p className="text-xs text-stone-500 capitalize">{item.category}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {editingPriceId === item.id ? (
                            <div className="flex items-center gap-1">
                              <input 
                                  type="number"
                                  value={tempPrice}
                                  onChange={(e) => setTempPrice(e.target.value)}
                                  className="w-16 bg-stone-800 border border-stone-600 rounded px-1 py-1 text-white text-sm"
                              />
                              <button onClick={() => savePrice(item.id)} className="p-1 bg-emerald-600 rounded text-white"><Save size={14}/></button>
                              <button onClick={() => setEditingPriceId(null)} className="p-1 bg-stone-700 rounded text-white"><X size={14}/></button>
                            </div>
                          ) : (
                            <>
                                <span className="font-bold text-emerald-400 text-sm">R$ {formatPrice(item.price)}</span>
                                <button onClick={() => startEditingPrice(item)} className="p-1 text-stone-500 hover:text-white" title="Editar Preço"><Edit2 size={14}/></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {cleanMenuItems.length === 0 && <p className="text-stone-500 p-4">Sem itens. Adicione um novo prato acima.</p>}
                </div>
             </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
           <div className="space-y-6">
              
              {!isSchemaValid && (
                <div className="bg-red-900/10 border border-red-500 rounded-2xl p-6">
                   <h3 className="text-red-500 font-bold mb-2 flex items-center gap-2">
                     <ShieldAlert size={20} />
                     Ação Necessária: Atualização de Banco de Dados
                   </h3>
                   <p className="text-sm text-stone-400 mb-4">
                     O sistema detectou que a tabela de <code>orders</code> ainda não existe. O sistema de Checkout não funcionará corretamente.
                     Por favor, copie o SQL abaixo e rode no seu painel do Supabase.
                   </p>
                </div>
              )}

              <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800">
                 <h3 className="font-bold text-white mb-4">Avisos do Site</h3>
                 <div className="flex gap-2 mb-4">
                    <input 
                      className="flex-1 bg-stone-950 border border-stone-700 rounded p-2 text-white"
                      placeholder="Novo aviso..."
                      value={newAnnouncementText}
                      onChange={(e) => setNewAnnouncementText(e.target.value)}
                    />
                    <button onClick={handlePostAnnouncement} className="bg-orange-600 text-white px-4 rounded font-bold">Criar</button>
                 </div>
                 <div className="space-y-2">
                    {announcements.map(ann => (
                      <div key={ann.id} className="flex justify-between items-center p-3 bg-stone-950 rounded border border-stone-800">
                         <span className={ann.isActive ? 'text-white' : 'text-stone-500'}>{ann.message}</span>
                         <button onClick={() => handleToggleAnnouncement(ann.id, ann.isActive)} className="text-xs underline text-orange-500">
                           {ann.isActive ? 'Desativar' : 'Ativar'}
                         </button>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800">
                 <h3 className="font-bold text-white mb-2">Banco de Dados & SQL</h3>
                 <p className="text-xs text-stone-500 mb-4">
                   Este script atualiza todo o banco de dados e <b>popula automaticamente o cardápio com itens padrão.</b>
                 </p>
                 <div className="bg-black p-4 rounded text-xs font-mono text-emerald-400 overflow-x-auto relative max-h-60 overflow-y-auto">
                    <pre>{sqlCommand}</pre>
                    <button onClick={copySql} className="absolute top-2 right-2 bg-stone-800 px-2 py-1 rounded text-white sticky">Copiar</button>
                 </div>
              </div>
           </div>
        )}

      </main>
    </div>
  );
};

export default AdminDashboard;