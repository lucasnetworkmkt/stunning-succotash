// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Configurar CORS (Permitir que seu site chame esta função)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Pegar a chave secreta do cofre do Supabase
    // Você configura isso no Painel do Supabase > Edge Functions > Secrets > Add "STRIPE_SECRET_KEY"
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!stripeKey) {
      console.error("ERRO CRÍTICO: STRIPE_SECRET_KEY não encontrada.");
      throw new Error("Configuração de pagamento incompleta no servidor.");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // 3. Receber dados do Frontend
    const { orderId, items, returnUrl } = await req.json()

    console.log(`Iniciando checkout para pedido ${orderId}`);

    // 4. Criar a sessão no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item: any) => ({
        price_data: {
          currency: 'brl', // Moeda Real
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100), // Stripe usa centavos (100 = R$ 1,00)
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${returnUrl}?success=true&order_id=${orderId}`, // Para onde o usuário volta se pagar
      cancel_url: `${returnUrl}?canceled=true`, // Para onde volta se cancelar
    })

    // 5. Devolver o link de pagamento
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Erro no Backend:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})