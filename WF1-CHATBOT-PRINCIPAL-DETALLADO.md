# WF1: Chatbot Principal - Configuración Detallada Nodo por Nodo

## Descripción del Workflow
Chatbot inteligente 24/7 que maneja conversaciones con clientes, identifica nuevos vs. existentes, recopila pedidos completos y crea órdenes automáticamente en Shopify.

## Arquitectura Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW 1: CHATBOT PRINCIPAL                     │
└─────────────────────────────────────────────────────────────────────┘

[Telegram Trigger] → [Code: Extraer Datos] → [Postgres: Buscar Cliente]
                                                        ↓
                            ┌──────────────────────────┴───────────────────────┐
                            ↓                                                  ↓
                    [IF: Cliente Existe?]
                            │
                ┌───────────┴───────────┐
                ↓                       ↓
    [Code: Preparar Saludo       [Code: Preparar Saludo
     Personalizado - Existente]   Nuevo Cliente]
                │                       │
                └───────────┬───────────┘
                            ↓
                    [Merge: Unificar]
                            ↓
                [AI Agent: Conversación]
                            ↓
                [Telegram: Enviar Respuesta]
                            ↓
            [IF: ¿Pedido Completo?] ────── NO → [FIN]
                            │
                          SÍ ↓
                [Code: Extraer Pedido]
                            ↓
            [IF: ¿Cliente Nuevo?] ────────────┐
                            │                 │
                          SÍ ↓               NO ↓
    [Postgres: Crear Cliente]         [No Operation]
                            │                 │
                            └────────┬────────┘
                                     ↓
                        [Merge: Unir Cliente]
                                     ↓
                        [Shopify: Create Order]
                                     ↓
                        [Postgres: Registrar Pedido]
                                     ↓
                        [Code: Preparar Confirmación]
                                     ↓
                        [Telegram: Confirmar Pedido]
                                     ↓
                                  [FIN]
```

---

## CONFIGURACIÓN DETALLADA DE CADA NODO

---

### NODO 1: Telegram Trigger
**Tipo:** `n8n-nodes-base.telegramTrigger`
**Nombre:** `Telegram Trigger - Mensajes Entrantes`
**Icono:** 📱

#### Configuración de Parámetros:

```json
{
  "updates": ["message"],
  "additionalFields": {
    "download": true,
    "includeTypes": ["message", "edited_message"]
  }
}
```

#### Detalles de Configuración:

**Credentials:**
- **Tipo:** `telegramApi`
- **Configuración:**
  - **Bot Token:** Obtener de @BotFather en Telegram
  - **Base URL:** `https://api.telegram.org` (por defecto)

**Updates a Escuchar:**
- ✅ `message` - Mensajes nuevos
- ✅ `edited_message` - Mensajes editados
- ⬜ `channel_post` - No necesario
- ⬜ `callback_query` - Para futura implementación de botones

**Additional Fields:**
- **Download Media:** `true` - Descarga automáticamente fotos/archivos
- **Binary Property Name:** `data` (default)

**Salida del Nodo:**
```json
{
  "message": {
    "message_id": 12345,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "Juan",
      "last_name": "Pérez",
      "username": "juanperez"
    },
    "chat": {
      "id": 987654321,
      "first_name": "Juan",
      "type": "private"
    },
    "date": 1699876543,
    "text": "Hola, quiero hacer un pedido",
    "photo": []
  },
  "update_id": 123456789
}
```

---

### NODO 2: Code - Extraer Datos del Mensaje
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Normalizar Datos Telegram`
**Icono:** 📝

#### Configuración de Parámetros:

```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Ver código abajo"
}
```

#### Código JavaScript Completo:

```javascript
// Extraer datos del mensaje de Telegram
const items = $input.all();
const results = [];

for (const item of items) {
  const message = item.json.message;

  // Validar que existe el mensaje
  if (!message) {
    results.push({
      json: {
        error: 'No message data received',
        rawData: item.json
      }
    });
    continue;
  }

  // Extraer información del usuario
  const userId = message.from?.id || message.chat?.id;
  const phone = userId ? userId.toString() : null; // Telegram ID como identificador único
  const userName = [
    message.from?.first_name,
    message.from?.last_name
  ].filter(Boolean).join(' ') || 'Cliente';

  const username = message.from?.username || null;

  // Extraer contenido del mensaje
  const text = message.text || message.caption || '';

  // Detectar archivos multimedia
  const photos = message.photo || [];
  const hasPhoto = photos.length > 0;
  const photoFileId = hasPhoto ? photos[photos.length - 1].file_id : null;

  // Detectar documentos
  const document = message.document || null;
  const hasDocument = !!document;
  const documentFileId = document?.file_id || null;

  // IDs de chat
  const chatId = message.chat.id;
  const messageId = message.message_id;

  // Timestamp
  const timestamp = new Date(message.date * 1000).toISOString();

  // Detectar si es una edición
  const isEdit = item.json.hasOwnProperty('edited_message');

  results.push({
    json: {
      // Identificación
      phone: phone,
      userId: userId,
      userName: userName,
      username: username,

      // Contenido
      text: text,

      // Multimedia
      hasPhoto: hasPhoto,
      photoFileId: photoFileId,
      hasDocument: hasDocument,
      documentFileId: documentFileId,

      // Contexto de chat
      chatId: chatId,
      messageId: messageId,
      timestamp: timestamp,
      isEdit: isEdit,

      // Datos originales para referencia
      originalMessage: message
    }
  });
}

return results;
```

**Salida del Nodo:**
```json
{
  "phone": "987654321",
  "userId": 987654321,
  "userName": "Juan Pérez",
  "username": "juanperez",
  "text": "Hola, quiero hacer un pedido",
  "hasPhoto": false,
  "photoFileId": null,
  "hasDocument": false,
  "documentFileId": null,
  "chatId": 987654321,
  "messageId": 12345,
  "timestamp": "2024-11-13T10:15:43.000Z",
  "isEdit": false
}
```

---

### NODO 3: Postgres - Buscar Cliente
**Tipo:** `n8n-nodes-base.postgres`
**Nombre:** `Postgres - Verificar Cliente Existente`
**Icono:** 🐘

#### Configuración de Parámetros:

```json
{
  "operation": "executeQuery",
  "query": "-- Ver query abajo",
  "additionalFields": {
    "queryReplacement": "={{ $json.phone }}"
  }
}
```

#### SQL Query:

```sql
SELECT
  c.id,
  c.phone,
  c.name,
  c.address,
  c.email,
  c.created_at,
  c.last_order_id,
  c.total_orders,
  c.last_order_date,
  c.customer_notes,
  -- Último pedido
  lo.shopify_order_number as last_order_number,
  lo.order_details as last_order_details,
  lo.created_at as last_order_created_at
FROM customers c
LEFT JOIN orders lo ON c.last_order_id = lo.id
WHERE c.phone = $1
LIMIT 1;
```

**Parámetros Query:**
- **$1:** `={{ $json.phone }}`

**Credentials:**
- **Tipo:** `postgres`
- **Host:** Tu servidor PostgreSQL
- **Database:** `shopify_chatbot`
- **User:** `n8n_user`
- **Password:** Tu contraseña
- **Port:** `5432`
- **SSL:** `allow` o `require` según tu configuración

**Opciones Adicionales:**
- **Execute Query:** `SELECT`
- **Return All:** `false` (retorna solo un registro)

**Salida del Nodo (Cliente Existente):**
```json
{
  "id": 42,
  "phone": "987654321",
  "name": "Juan Pérez",
  "address": "Av. Corrientes 1234, CABA, Buenos Aires, C1043",
  "email": "juan@email.com",
  "created_at": "2024-10-15T14:30:00.000Z",
  "last_order_id": 128,
  "total_orders": 5,
  "last_order_date": "2024-11-01T16:45:00.000Z",
  "customer_notes": "Cliente preferencial",
  "last_order_number": "8765",
  "last_order_details": {
    "products": [
      {"name": "Producto A", "quantity": 2, "price": 1500}
    ],
    "paymentMethod": "transferencia"
  },
  "last_order_created_at": "2024-11-01T16:45:00.000Z"
}
```

**Salida del Nodo (Cliente Nuevo):**
```json
{}
```

---

### NODO 4: IF - ¿Cliente Existe?
**Tipo:** `n8n-nodes-base.if`
**Nombre:** `IF - Verificar Cliente Existe`
**Icono:** ↔️

#### Configuración de Parámetros:

```json
{
  "conditions": {
    "boolean": [],
    "number": [],
    "string": [
      {
        "value1": "={{ $json.id }}",
        "operation": "isNotEmpty"
      }
    ]
  },
  "combineOperation": "all"
}
```

#### Detalles de Condiciones:

**Condición 1:**
- **Value 1:** `={{ $json.id }}`
- **Operation:** `isNotEmpty`
- **Lógica:** Si el cliente tiene un ID en la base de datos, existe

**Rutas de Salida:**
- **true:** Cliente existe en la base de datos
- **false:** Cliente nuevo (necesita registro)

---

### NODO 5A: Code - Preparar Saludo Personalizado (Cliente Existente)
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Saludo Cliente Existente`
**Conectado desde:** IF node (true branch)

#### Código JavaScript:

```javascript
// Preparar contexto para cliente existente
const customer = $input.item.json;
const messageData = $('Code - Normalizar Datos Telegram').item.json;

// Parsear detalles del último pedido si existen
let lastOrderSummary = '';
if (customer.last_order_details) {
  const lastOrder = typeof customer.last_order_details === 'string'
    ? JSON.parse(customer.last_order_details)
    : customer.last_order_details;

  if (lastOrder.products && lastOrder.products.length > 0) {
    const productList = lastOrder.products
      .map(p => `${p.name} (x${p.quantity})`)
      .join(', ');
    lastOrderSummary = `\nTu último pedido (#${customer.last_order_number}) incluía: ${productList}`;
  }
}

// Calcular días desde el último pedido
let daysSinceLastOrder = null;
if (customer.last_order_date) {
  const lastDate = new Date(customer.last_order_date);
  const now = new Date();
  daysSinceLastOrder = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
}

// Construir mensaje de bienvenida personalizado
const greeting = `¡Hola ${customer.name}! 👋 Me alegra verte de nuevo.

📊 Resumen de tu cuenta:
• Has realizado ${customer.total_orders} ${customer.total_orders === 1 ? 'pedido' : 'pedidos'} con nosotros
${daysSinceLastOrder !== null ? `• Tu último pedido fue hace ${daysSinceLastOrder} días` : ''}
${lastOrderSummary}

¿En qué puedo ayudarte hoy?`;

// Preparar contexto para el AI Agent
const aiContext = {
  customerType: 'existing',
  customerId: customer.id,
  customerName: customer.name,
  phone: customer.phone,
  address: customer.address,
  email: customer.email,
  totalOrders: customer.total_orders,
  lastOrderNumber: customer.last_order_number,
  lastOrderDate: customer.last_order_date,
  hasCompleteSavedAddress: !!customer.address,
  notes: `Cliente existente con ${customer.total_orders} pedidos. ` +
         `Dirección guardada: ${customer.address || 'No registrada'}. ` +
         `${daysSinceLastOrder !== null ? `Última compra hace ${daysSinceLastOrder} días.` : ''}`
};

return {
  // Datos del cliente
  ...customer,

  // Mensaje de saludo
  greeting: greeting,

  // Contexto para AI
  aiContext: aiContext,

  // Datos del mensaje original
  currentMessage: messageData.text,
  chatId: messageData.chatId,
  messageId: messageData.messageId,

  // Flags
  isNewCustomer: false,
  requiresRegistration: false
};
```

**Salida del Nodo:**
```json
{
  "id": 42,
  "phone": "987654321",
  "name": "Juan Pérez",
  "address": "Av. Corrientes 1234, CABA, Buenos Aires, C1043",
  "total_orders": 5,
  "greeting": "¡Hola Juan Pérez! 👋 Me alegra verte de nuevo...",
  "aiContext": {
    "customerType": "existing",
    "customerId": 42,
    "customerName": "Juan Pérez",
    "phone": "987654321",
    "address": "Av. Corrientes 1234, CABA, Buenos Aires, C1043",
    "totalOrders": 5,
    "notes": "Cliente existente con 5 pedidos..."
  },
  "currentMessage": "Hola, quiero hacer un pedido",
  "chatId": 987654321,
  "isNewCustomer": false,
  "requiresRegistration": false
}
```

---

### NODO 5B: Code - Preparar Saludo Nuevo Cliente (Cliente Nuevo)
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Saludo Cliente Nuevo`
**Conectado desde:** IF node (false branch)

#### Código JavaScript:

```javascript
// Preparar contexto para cliente nuevo
const messageData = $('Code - Normalizar Datos Telegram').item.json;

// Mensaje de bienvenida para cliente nuevo
const greeting = `¡Hola ${messageData.userName}! 👋

¡Bienvenido/a! Veo que es tu primera vez con nosotros. Me encanta ayudarte a realizar tu pedido.

Para comenzar, necesito algunos datos:
1️⃣ Tu nombre completo
2️⃣ Tu dirección de envío completa

¿Podrías proporcionarme esta información?`;

// Contexto para el AI Agent
const aiContext = {
  customerType: 'new',
  customerId: null,
  customerName: messageData.userName, // Nombre de Telegram temporal
  phone: messageData.phone,
  address: null,
  email: null,
  totalOrders: 0,
  hasCompleteSavedAddress: false,
  notes: 'Cliente NUEVO - DEBE recopilar: 1) Nombre completo, 2) Dirección de envío completa (calle, número, ciudad, código postal). ' +
         'NO proceder con el pedido hasta tener TODOS estos datos. ' +
         'Confirmar datos antes de continuar.'
};

return {
  // Datos básicos del mensaje
  phone: messageData.phone,
  userId: messageData.userId,
  userName: messageData.userName,
  username: messageData.username,

  // Mensaje de saludo
  greeting: greeting,

  // Contexto para AI
  aiContext: aiContext,

  // Datos del mensaje actual
  currentMessage: messageData.text,
  chatId: messageData.chatId,
  messageId: messageData.messageId,

  // Flags
  isNewCustomer: true,
  requiresRegistration: true,

  // Datos a recopilar
  pendingData: {
    fullName: null,
    shippingAddress: null
  }
};
```

**Salida del Nodo:**
```json
{
  "phone": "987654321",
  "userId": 987654321,
  "userName": "Juan",
  "greeting": "¡Hola Juan! 👋\n\n¡Bienvenido/a!...",
  "aiContext": {
    "customerType": "new",
    "customerId": null,
    "customerName": "Juan",
    "phone": "987654321",
    "totalOrders": 0,
    "notes": "Cliente NUEVO - DEBE recopilar: 1) Nombre completo..."
  },
  "currentMessage": "Hola, quiero hacer un pedido",
  "chatId": 987654321,
  "isNewCustomer": true,
  "requiresRegistration": true,
  "pendingData": {
    "fullName": null,
    "shippingAddress": null
  }
}
```

---

### NODO 6: Merge - Unificar Flujos
**Tipo:** `n8n-nodes-base.merge`
**Nombre:** `Merge - Unificar Cliente Nuevo/Existente`
**Icono:** 🔀

#### Configuración de Parámetros:

```json
{
  "mode": "mergeByPosition",
  "mergeByFields": {
    "values": []
  },
  "options": {}
}
```

#### Detalles de Merge:

**Mode:** `mergeByPosition`
- Combina items en la misma posición de ambas entradas
- Perfecto para IF nodes donde solo una rama se ejecuta

**Inputs:**
1. **Input 1:** Code - Saludo Cliente Existente (IF true)
2. **Input 2:** Code - Saludo Cliente Nuevo (IF false)

**Salida del Nodo:**
- Pasa todos los datos del nodo activo (existente o nuevo)
- Solo se ejecuta la rama que cumplió la condición del IF

---

### NODO 7: AI Agent - Conversación Inteligente
**Tipo:** `@n8n/n8n-nodes-langchain.agent`
**Nombre:** `AI Agent - Asistente de Ventas`
**Icono:** 🤖

#### Configuración de Parámetros:

```json
{
  "promptType": "define",
  "text": "={{ $json.aiContext.notes }}\n\nMensaje actual del cliente: {{ $json.currentMessage }}",
  "hasOutputParser": false,
  "options": {
    "systemMessage": "VER SYSTEM PROMPT COMPLETO ABAJO"
  }
}
```

#### System Prompt Completo:

```
Eres un asistente de ventas experto para una tienda de comercio electrónico conectada a Shopify. Tu objetivo es ayudar a los clientes a realizar pedidos de manera eficiente y profesional.

CONTEXTO DEL CLIENTE ACTUAL:
{{ JSON.stringify($json.aiContext, null, 2) }}

═══════════════════════════════════════════════════════════════

📋 TUS RESPONSABILIDADES:

1. PARA CLIENTES NUEVOS (customerType: 'new'):
   ├─ PASO 1: Recopilar NOMBRE COMPLETO
   │  └─ Ejemplo: "Juan Carlos Pérez González"
   │  └─ Validar que sea nombre + apellido mínimo
   │
   ├─ PASO 2: Recopilar DIRECCIÓN COMPLETA DE ENVÍO
   │  └─ Debe incluir: Calle, Número, Piso/Depto (si aplica), Ciudad, Código Postal
   │  └─ Ejemplo: "Av. Corrientes 1234, Piso 5 Dto A, CABA, Buenos Aires, C1043"
   │  └─ Validar que esté completa antes de continuar
   │
   └─ ⚠️ NO CONTINUAR CON EL PEDIDO hasta tener AMBOS datos completos

2. PARA TODOS LOS CLIENTES:
   ├─ Ayudar a elegir productos del catálogo
   ├─ Confirmar detalles del pedido
   ├─ Preguntar método de pago
   └─ Recopilar comentarios adicionales

═══════════════════════════════════════════════════════════════

💳 MÉTODOS DE PAGO DISPONIBLES:

1. "efectivo" - Pago en efectivo o tarjeta en el momento de la entrega
2. "transferencia" - Transferencia bancaria (requiere comprobante antes del envío)

Pregunta al cliente cuál prefiere.

═══════════════════════════════════════════════════════════════

📦 PRODUCTOS DISPONIBLES (EJEMPLO - AJUSTAR SEGÚN TU CATÁLOGO):

• Producto A - $1,500
• Producto B - $2,200
• Producto C - $850
• Producto D - $3,500

(Adapta este catálogo a tus productos reales)

═══════════════════════════════════════════════════════════════

✅ CUANDO EL PEDIDO ESTÉ COMPLETO:

Cuando tengas TODA la información necesaria:

PARA CLIENTE NUEVO:
- ✅ Nombre completo
- ✅ Dirección de envío completa
- ✅ Productos seleccionados con cantidades
- ✅ Método de pago elegido
- ✅ Comentarios adicionales (opcional)

PARA CLIENTE EXISTENTE:
- ✅ Productos seleccionados con cantidades
- ✅ Confirmar/actualizar dirección de envío
- ✅ Método de pago elegido
- ✅ Comentarios adicionales (opcional)

Responde EXACTAMENTE en este formato:

PEDIDO_COMPLETO:
{
  "customerName": "Nombre completo del cliente" (solo para nuevos),
  "shippingAddress": "Dirección completa de envío",
  "products": [
    {
      "name": "Nombre del producto",
      "quantity": 1,
      "price": 1500
    }
  ],
  "paymentMethod": "efectivo o transferencia",
  "comments": "Comentarios adicionales del cliente",
  "totalAmount": 1500
}

═══════════════════════════════════════════════════════════════

⚠️ REGLAS IMPORTANTES:

1. Sé amigable y profesional en todo momento
2. Confirma cada dato antes de agregarlo al pedido
3. Si el cliente pide ver el estado de un pedido anterior, pídele el número de pedido
4. Si el cliente tiene dudas sobre productos, ofrece descripciones detalladas
5. NUNCA inventes información de productos o precios
6. Si algo no está claro, pregunta antes de asumir
7. Valida que la dirección esté completa antes de finalizar
8. Confirma el método de pago elegido
9. Resume el pedido completo antes de enviar PEDIDO_COMPLETO

═══════════════════════════════════════════════════════════════

🔄 MANEJO DE CONVERSACIONES:

- Si el cliente saluda, saluda de vuelta y ofrece ayuda
- Si pide información, proporciónala claramente
- Si quiere cambiar algo del pedido, permite modificaciones
- Si cancela, confirma la cancelación amablemente
- Mantén un tono conversacional y natural

═══════════════════════════════════════════════════════════════

Ahora procesa el mensaje del cliente y responde apropiadamente.
```

#### Configuración del Chat Model:

**Model:** `gpt-4o` o `gpt-4-turbo`
**Conectado a:** OpenAI Chat Model node

**OpenAI Chat Model Configuration:**
```json
{
  "model": "gpt-4o",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "topP": 1,
    "frequencyPenalty": 0,
    "presencePenalty": 0
  }
}
```

**Credentials:**
- **Tipo:** `openAiApi`
- **API Key:** Tu OpenAI API Key

#### Conexiones del Agent:

**Inputs:**
- **Chat Input:** Merge node (datos unificados)

**Sub-Nodes (Tools):**
- Memory (Chat Memory para mantener contexto)
- OpenAI Chat Model

**Memoria de Chat:**
```json
{
  "sessionKey": "={{ $json.chatId }}",
  "contextWindowLength": 10
}
```

**Salida del Nodo (Respuesta Normal):**
```json
{
  "response": "¡Perfecto! Veo que quieres hacer un pedido. ¿Qué producto te interesa? Tenemos:\n\n• Producto A - $1,500\n• Producto B - $2,200\n• Producto C - $850\n\n¿Cuál te gustaría ordenar?",
  "chatId": 987654321
}
```

**Salida del Nodo (Pedido Completo):**
```json
{
  "response": "PEDIDO_COMPLETO:\n{\n  \"customerName\": \"Juan Carlos Pérez\",\n  \"shippingAddress\": \"Av. Corrientes 1234, Piso 5 Dto A, CABA, Buenos Aires, C1043\",\n  \"products\": [\n    {\"name\": \"Producto A\", \"quantity\": 2, \"price\": 1500}\n  ],\n  \"paymentMethod\": \"transferencia\",\n  \"comments\": \"Entregar por la mañana\",\n  \"totalAmount\": 3000\n}",
  "chatId": 987654321
}
```

---

### NODO 8: Telegram - Enviar Respuesta
**Tipo:** `n8n-nodes-base.telegram`
**Nombre:** `Telegram - Responder al Cliente`
**Icono:** 💬

#### Configuración de Parámetros:

```json
{
  "resource": "message",
  "operation": "sendMessage",
  "chatId": "={{ $('Merge - Unificar Cliente Nuevo/Existente').item.json.chatId }}",
  "text": "={{ $json.response || $json.output || 'Lo siento, hubo un error. Por favor intenta de nuevo.' }}",
  "additionalFields": {
    "parse_mode": "Markdown",
    "disable_web_page_preview": true,
    "reply_to_message_id": "={{ $('Code - Normalizar Datos Telegram').item.json.messageId }}"
  }
}
```

#### Detalles de Configuración:

**Resource:** `message`
**Operation:** `sendMessage`

**Parámetros Obligatorios:**
- **Chat ID:** `={{ $('Merge - Unificar Cliente Nuevo/Existente').item.json.chatId }}`
  - ID del chat donde se envía la respuesta
- **Text:** `={{ $json.response }}`
  - Texto de la respuesta del AI Agent

**Additional Fields:**
- **Parse Mode:** `Markdown`
  - Permite formato: **negrita**, *cursiva*, `código`
- **Disable Web Page Preview:** `true`
  - No muestra preview de links en el mensaje
- **Reply to Message ID:** `={{ $('Code - Normalizar Datos Telegram').item.json.messageId }}`
  - Responde directamente al mensaje del cliente

**Credentials:**
- **Tipo:** `telegramApi`
- **Bot Token:** Mismo que Telegram Trigger

---

### NODO 9: IF - ¿Pedido Completo?
**Tipo:** `n8n-nodes-base.if`
**Nombre:** `IF - Detectar Pedido Completo`
**Icono:** ✅

#### Configuración de Parámetros:

```json
{
  "conditions": {
    "string": [
      {
        "value1": "={{ $json.response || $json.output || '' }}",
        "operation": "contains",
        "value2": "PEDIDO_COMPLETO:"
      }
    ]
  },
  "combineOperation": "all"
}
```

#### Detalles de Condiciones:

**Condición 1:**
- **Value 1:** `={{ $json.response || $json.output || '' }}`
- **Operation:** `contains`
- **Value 2:** `"PEDIDO_COMPLETO:"`
- **Lógica:** Detecta si el AI Agent marcó que el pedido está completo

**Rutas de Salida:**
- **true:** Pedido completo → Procesar y crear en Shopify
- **false:** Conversación continúa → Fin del workflow (esperar próximo mensaje)

---

### NODO 10: Code - Extraer y Validar Pedido
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Procesar Pedido Completo`
**Conectado desde:** IF node (true branch)

#### Código JavaScript Completo:

```javascript
// Extraer y validar el pedido completo
const aiResponse = $input.item.json.response || $input.item.json.output || '';
const customerContext = $('Merge - Unificar Cliente Nuevo/Existente').item.json;
const messageData = $('Code - Normalizar Datos Telegram').item.json;

// =========================================================================
// PASO 1: Extraer JSON del pedido
// =========================================================================
const match = aiResponse.match(/PEDIDO_COMPLETO:\s*\n?\s*(\{[\s\S]*?\})\s*$/);

if (!match || !match[1]) {
  throw new Error('ERROR: No se pudo extraer el pedido del formato PEDIDO_COMPLETO. Respuesta del AI: ' + aiResponse);
}

let orderData;
try {
  orderData = JSON.parse(match[1]);
} catch (parseError) {
  throw new Error('ERROR: El JSON del pedido es inválido. Error: ' + parseError.message + '. JSON: ' + match[1]);
}

// =========================================================================
// PASO 2: Validar campos obligatorios
// =========================================================================
const validationErrors = [];

// Validar productos
if (!orderData.products || !Array.isArray(orderData.products) || orderData.products.length === 0) {
  validationErrors.push('No se especificaron productos en el pedido');
}

// Validar dirección de envío
if (!orderData.shippingAddress || orderData.shippingAddress.trim() === '') {
  validationErrors.push('No se especificó dirección de envío');
}

// Validar método de pago
const validPaymentMethods = ['efectivo', 'transferencia'];
if (!orderData.paymentMethod || !validPaymentMethods.includes(orderData.paymentMethod.toLowerCase())) {
  validationErrors.push(`Método de pago inválido: ${orderData.paymentMethod}. Debe ser 'efectivo' o 'transferencia'`);
}

// Para clientes nuevos, validar nombre completo
if (customerContext.isNewCustomer) {
  if (!orderData.customerName || orderData.customerName.trim().split(' ').length < 2) {
    validationErrors.push('Nombre completo inválido para cliente nuevo (debe incluir nombre y apellido)');
  }
}

// Si hay errores, lanzar excepción
if (validationErrors.length > 0) {
  throw new Error('ERRORES DE VALIDACIÓN DEL PEDIDO:\n' + validationErrors.join('\n'));
}

// =========================================================================
// PASO 3: Normalizar y procesar datos del pedido
// =========================================================================

// Normalizar método de pago
const paymentMethod = orderData.paymentMethod.toLowerCase();

// Procesar productos y calcular total
const products = orderData.products.map(product => {
  return {
    name: product.name || 'Producto sin nombre',
    quantity: parseInt(product.quantity) || 1,
    price: parseFloat(product.price) || 0,
    total: (parseInt(product.quantity) || 1) * (parseFloat(product.price) || 0)
  };
});

// Calcular total del pedido
const calculatedTotal = products.reduce((sum, p) => sum + p.total, 0);
const totalAmount = orderData.totalAmount || calculatedTotal;

// Si hay discrepancia en el total, usar el calculado
if (Math.abs(totalAmount - calculatedTotal) > 0.01) {
  console.log(`Advertencia: Total declarado (${totalAmount}) difiere del calculado (${calculatedTotal}). Usando calculado.`);
}

// =========================================================================
// PASO 4: Preparar datos del cliente
// =========================================================================
const isNewCustomer = customerContext.isNewCustomer || !customerContext.id;

const customerData = {
  // ID (null para nuevos)
  id: isNewCustomer ? null : customerContext.id,

  // Identificación
  phone: messageData.phone || customerContext.phone,

  // Nombre (del pedido si es nuevo, de BD si existe)
  name: isNewCustomer
    ? (orderData.customerName || messageData.userName)
    : customerContext.name,

  // Dirección (siempre tomar la del pedido actual)
  address: orderData.shippingAddress,

  // Email (si existe)
  email: customerContext.email || null,

  // Metadata
  isNew: isNewCustomer,
  username: messageData.username || customerContext.username || null
};

// =========================================================================
// PASO 5: Preparar objeto de pedido completo
// =========================================================================
const completeOrder = {
  // Datos del cliente
  customer: customerData,

  // Productos
  products: products,

  // Dirección de envío
  shippingAddress: orderData.shippingAddress,

  // Pago
  paymentMethod: paymentMethod,
  totalAmount: calculatedTotal,

  // Comentarios
  comments: orderData.comments || '',

  // Metadata
  source: 'telegram',
  telegramChatId: messageData.chatId,
  telegramUserId: messageData.userId,
  orderDate: new Date().toISOString(),

  // Validación requerida
  requiresPaymentValidation: true,
  paymentStatus: 'pending'
};

// =========================================================================
// PASO 6: Preparar resumen para el cliente
// =========================================================================
const orderSummary = {
  customerName: customerData.name,
  productsCount: products.length,
  itemsCount: products.reduce((sum, p) => sum + p.quantity, 0),
  totalAmount: calculatedTotal,
  paymentMethod: paymentMethod,
  shippingAddress: orderData.shippingAddress
};

// =========================================================================
// RETORNAR DATOS
// =========================================================================
return {
  order: completeOrder,
  customer: customerData,
  products: products,
  paymentMethod: paymentMethod,
  totalAmount: calculatedTotal,
  orderSummary: orderSummary,
  isNewCustomer: isNewCustomer,
  requiresPaymentValidation: true,

  // Debugging
  _debug: {
    extractedJSON: orderData,
    validationPassed: true,
    calculatedTotal: calculatedTotal
  }
};
```

**Salida del Nodo:**
```json
{
  "order": {
    "customer": {
      "id": null,
      "phone": "987654321",
      "name": "Juan Carlos Pérez",
      "address": "Av. Corrientes 1234, Piso 5 Dto A, CABA, C1043",
      "isNew": true
    },
    "products": [
      {
        "name": "Producto A",
        "quantity": 2,
        "price": 1500,
        "total": 3000
      }
    ],
    "shippingAddress": "Av. Corrientes 1234, Piso 5 Dto A, CABA, C1043",
    "paymentMethod": "transferencia",
    "totalAmount": 3000,
    "comments": "Entregar por la mañana",
    "source": "telegram"
  },
  "customer": {
    "id": null,
    "phone": "987654321",
    "name": "Juan Carlos Pérez",
    "address": "Av. Corrientes 1234, Piso 5 Dto A, CABA, C1043",
    "isNew": true
  },
  "products": [...],
  "paymentMethod": "transferencia",
  "totalAmount": 3000,
  "isNewCustomer": true,
  "requiresPaymentValidation": true
}
```

---

### NODO 11: IF - ¿Cliente Nuevo?
**Tipo:** `n8n-nodes-base.if`
**Nombre:** `IF - Verificar Cliente Nuevo`
**Icono:** 🆕

#### Configuración de Parámetros:

```json
{
  "conditions": {
    "boolean": [
      {
        "value1": "={{ $json.isNewCustomer }}",
        "value2": true
      }
    ]
  }
}
```

**Rutas:**
- **true:** Cliente nuevo → Crear en base de datos
- **false:** Cliente existente → Pasar directamente a Shopify

---

### NODO 11A: Postgres - Crear Cliente
**Tipo:** `n8n-nodes-base.postgres`
**Nombre:** `Postgres - Registrar Cliente Nuevo`
**Conectado desde:** IF node (true branch)

#### SQL Query:

```sql
INSERT INTO customers (
  phone,
  name,
  address,
  email,
  telegram_username,
  telegram_user_id,
  created_at,
  total_orders,
  source
)
VALUES (
  $1, $2, $3, $4, $5, $6, NOW(), 0, 'telegram'
)
RETURNING
  id,
  phone,
  name,
  address,
  email,
  created_at;
```

**Parámetros:**
- **$1:** `={{ $json.customer.phone }}`
- **$2:** `={{ $json.customer.name }}`
- **$3:** `={{ $json.customer.address }}`
- **$4:** `={{ $json.customer.email }}`
- **$5:** `={{ $json.customer.username }}`
- **$6:** `={{ $json.order.telegramUserId }}`

**Salida:**
```json
{
  "id": 43,
  "phone": "987654321",
  "name": "Juan Carlos Pérez",
  "address": "Av. Corrientes 1234, Piso 5 Dto A, CABA, C1043",
  "email": null,
  "created_at": "2024-11-13T11:30:00.000Z"
}
```

---

### NODO 12: Merge - Unir Datos de Cliente
**Tipo:** `n8n-nodes-base.merge`
**Nombre:** `Merge - Cliente Nuevo/Existente`

**Mode:** `mergeByPosition`

**Inputs:**
1. Postgres - Crear Cliente (nuevos)
2. Code - Procesar Pedido (existentes)

---

### NODO 13: Shopify - Create Order
**Tipo:** `n8n-nodes-base.shopify`
**Nombre:** `Shopify - Crear Orden`
**Icono:** 🛒

#### Configuración de Parámetros:

```json
{
  "resource": "order",
  "operation": "create",
  "additionalFields": {
    "customerId": "",
    "email": "={{ $json.customer?.email || null }}",
    "phone": "={{ $json.customer.phone }}",
    "shippingAddress": {
      "address1": "={{ $json.order.shippingAddress }}",
      "phone": "={{ $json.customer.phone }}",
      "firstName": "={{ $json.customer.name.split(' ')[0] }}",
      "lastName": "={{ $json.customer.name.split(' ').slice(1).join(' ') }}"
    },
    "lineItems": "={{ JSON.stringify($json.products.map(p => ({ title: p.name, quantity: p.quantity, price: p.price }))) }}",
    "financialStatus": "pending",
    "tags": "telegram,{{ $json.paymentMethod }},mcp-chatbot",
    "note": "PEDIDO VÍA TELEGRAM CHATBOT\n\nMétodo de pago: {{ $json.paymentMethod }}\nComentarios: {{ $json.order.comments }}\n\nTelegram User ID: {{ $json.order.telegramUserId }}\nChat ID: {{ $json.order.telegramChatId }}",
    "sendReceipt": false,
    "sendFulfillmentReceipt": false
  }
}
```

#### Detalles Específicos:

**Line Items (formato correcto):**
```javascript
// En Additional Fields > Line Items
={{
  $json.products.map(p => ({
    title: p.name,
    quantity: p.quantity,
    price: String(p.price),
    taxable: false
  }))
}}
```

**Shipping Address:**
```javascript
={{
  {
    address1: $json.order.shippingAddress,
    phone: $json.customer.phone,
    firstName: $json.customer.name.split(' ')[0],
    lastName: $json.customer.name.split(' ').slice(1).join(' ') || $json.customer.name.split(' ')[0],
    city: "Buenos Aires",
    country: "Argentina"
  }
}}
```

**Tags:**
- `telegram` - Origen del pedido
- `{{ $json.paymentMethod }}` - Método de pago
- `mcp-chatbot` - Identificador del sistema

**Credentials:**
- **Tipo:** `shopifyApi`
- **Shop Subdomain:** `tu-tienda`
- **API Key:** Tu Shopify API Key
- **API Secret:** Tu Shopify API Secret
- **Access Token:** Token de acceso

**Salida del Nodo:**
```json
{
  "id": 5678901234,
  "order_number": 8766,
  "name": "#8766",
  "email": null,
  "phone": "+5491123456789",
  "financial_status": "pending",
  "fulfillment_status": null,
  "total_price": "3000.00",
  "subtotal_price": "3000.00",
  "created_at": "2024-11-13T11:35:00-03:00",
  "line_items": [
    {
      "id": 12345678901234,
      "title": "Producto A",
      "quantity": 2,
      "price": "1500.00"
    }
  ],
  "customer": {
    "id": 6789012345,
    "first_name": "Juan Carlos",
    "last_name": "Pérez",
    "phone": "+5491123456789"
  }
}
```

---

### NODO 14: Postgres - Registrar Pedido
**Tipo:** `n8n-nodes-base.postgres`
**Nombre:** `Postgres - Guardar Orden en BD`

#### SQL Query:

```sql
INSERT INTO orders (
  customer_id,
  shopify_order_id,
  shopify_order_number,
  payment_method,
  payment_status,
  delivery_status,
  total_amount,
  order_details,
  telegram_chat_id,
  created_at
)
VALUES (
  $1, $2, $3, $4, 'pending', 'not_delivered', $5, $6::jsonb, $7, NOW()
)
RETURNING
  id,
  shopify_order_number,
  payment_method,
  payment_status,
  total_amount,
  created_at;
```

**Parámetros:**
- **$1:** `={{ $('Merge - Cliente Nuevo/Existente').item.json.id || $json.customer.id }}`
- **$2:** `={{ $json.id }}`
- **$3:** `={{ $json.order_number }}`
- **$4:** `={{ $('Code - Procesar Pedido Completo').item.json.paymentMethod }}`
- **$5:** `={{ $('Code - Procesar Pedido Completo').item.json.totalAmount }}`
- **$6:** `={{ JSON.stringify($('Code - Procesar Pedido Completo').item.json.order) }}`
- **$7:** `={{ $('Code - Procesar Pedido Completo').item.json.order.telegramChatId }}`

**Salida:**
```json
{
  "id": 256,
  "shopify_order_number": 8766,
  "payment_method": "transferencia",
  "payment_status": "pending",
  "total_amount": 3000,
  "created_at": "2024-11-13T11:35:30.000Z"
}
```

---

### NODO 15: Code - Preparar Confirmación
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Mensaje de Confirmación`

#### Código JavaScript:

```javascript
const shopifyOrder = $input.item.json;
const orderDetails = $('Code - Procesar Pedido Completo').item.json;
const postgresOrder = $json;

// Emojis según método de pago
const paymentEmoji = orderDetails.paymentMethod === 'transferencia' ? '🏦' : '💵';

// Instrucciones según método de pago
let paymentInstructions = '';
if (orderDetails.paymentMethod === 'transferencia') {
  paymentInstructions = `
${paymentEmoji} MÉTODO DE PAGO: Transferencia Bancaria

📸 IMPORTANTE: Para procesar tu pedido, envía el comprobante de transferencia:
   • Por este chat (foto del comprobante), O
   • Por email a: pagos@tutienda.com

Datos bancarios:
🏦 Banco: [TU BANCO]
👤 Titular: [TITULAR]
💳 CBU/CVU: [TU CBU]
💰 Monto: $${orderDetails.totalAmount}
📝 Referencia: Pedido #${shopifyOrder.order_number}

⚠️ Tu pedido quedará en estado "Pendiente de Pago" hasta validar el comprobante.`;
} else {
  paymentInstructions = `
${paymentEmoji} MÉTODO DE PAGO: Efectivo o Tarjeta en Ruta

📸 El conductor te entregará un comprobante al recibir el pago.
   Por favor fotografía y envíalo a este chat.

💰 Monto a abonar: $${orderDetails.totalAmount}

⚠️ Ten el monto exacto preparado para agilizar la entrega.`;
}

// Construir mensaje completo
const confirmationMessage = `
✅ ¡PEDIDO CREADO EXITOSAMENTE!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 NÚMERO DE PEDIDO: #${shopifyOrder.order_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 CLIENTE: ${orderDetails.customer.name}
📍 DIRECCIÓN: ${orderDetails.order.shippingAddress}

🛒 PRODUCTOS:
${orderDetails.products.map((p, i) =>
  `${i + 1}. ${p.name} x${p.quantity} - $${p.total}`
).join('\n')}

💰 TOTAL: $${orderDetails.totalAmount}

${orderDetails.order.comments ? `💬 COMENTARIOS: ${orderDetails.order.comments}\n` : ''}
${paymentInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ESTADO ACTUAL:
• Pago: ⏳ Pendiente de validación
• Envío: 📦 Preparando

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️ SEGUIMIENTO DE PEDIDO:

Puedes consultar el estado en cualquier momento enviando:
"Estado pedido #${shopifyOrder.order_number}"

o simplemente:
"Estado"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

¡Gracias por tu compra! 🙏
Cualquier duda, estoy aquí para ayudarte.
`;

return {
  confirmationMessage: confirmationMessage.trim(),
  orderNumber: shopifyOrder.order_number,
  shopifyOrderId: shopifyOrder.id,
  totalAmount: orderDetails.totalAmount,
  paymentMethod: orderDetails.paymentMethod,
  chatId: orderDetails.order.telegramChatId
};
```

---

### NODO 16: Telegram - Confirmar Pedido
**Tipo:** `n8n-nodes-base.telegram`
**Nombre:** `Telegram - Enviar Confirmación`

#### Configuración:

```json
{
  "resource": "message",
  "operation": "sendMessage",
  "chatId": "={{ $json.chatId }}",
  "text": "={{ $json.confirmationMessage }}",
  "additionalFields": {
    "parse_mode": "Markdown",
    "disable_web_page_preview": true
  }
}
```

---

## RESUMEN DE CONEXIONES

```
1. Telegram Trigger
   → 2. Code - Extraer Datos

2. Code - Extraer Datos
   → 3. Postgres - Buscar Cliente

3. Postgres - Buscar Cliente
   → 4. IF - Cliente Existe

4. IF - Cliente Existe:
   ├─ TRUE → 5A. Code - Saludo Existente → 6. Merge
   └─ FALSE → 5B. Code - Saludo Nuevo → 6. Merge

6. Merge
   → 7. AI Agent

7. AI Agent
   → 8. Telegram - Responder

8. Telegram - Responder
   → 9. IF - Pedido Completo

9. IF - Pedido Completo:
   ├─ TRUE → 10. Code - Extraer Pedido
   └─ FALSE → FIN (esperar próximo mensaje)

10. Code - Extraer Pedido
    → 11. IF - Cliente Nuevo

11. IF - Cliente Nuevo:
    ├─ TRUE → 11A. Postgres - Crear Cliente → 12. Merge
    └─ FALSE → 12. Merge (directo)

12. Merge
    → 13. Shopify - Create Order

13. Shopify - Create Order
    → 14. Postgres - Registrar Pedido

14. Postgres - Registrar Pedido
    → 15. Code - Preparar Confirmación

15. Code - Preparar Confirmación
    → 16. Telegram - Confirmar Pedido

16. Telegram - Confirmar Pedido
    → FIN
```

---

## CONFIGURACIONES GLOBALES DEL WORKFLOW

### Workflow Settings:

```json
{
  "name": "WF1 - Chatbot Principal Shopify",
  "nodes": [...],
  "connections": {...},
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "saveExecutionProgress": true,
    "callerPolicy": "workflowsFromSameOwner",
    "errorWorkflow": "[ID del workflow de manejo de errores]",
    "timezone": "America/Argentina/Buenos_Aires",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all"
  }
}
```

### Error Handling:

**En cada nodo:**
- **Continue On Fail:** `false` (detener en errores)
- **Retry On Fail:** `true`
- **Max Tries:** `3`
- **Wait Between Tries:** `1000` ms

**Nodos críticos (Shopify, Postgres):**
- **Max Tries:** `5`
- **Wait Between Tries:** `2000` ms
- **Error Output:** Enviar a workflow de notificación de errores

---

## VARIABLES DE ENTORNO REQUERIDAS

```bash
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Shopify
SHOPIFY_SHOP_NAME=tu-tienda
SHOPIFY_API_KEY=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_SECRET=shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=shopify_chatbot
POSTGRES_USER=n8n_user
POSTGRES_PASSWORD=tu_password_seguro
POSTGRES_SSL=true

# n8n
N8N_ENCRYPTION_KEY=tu_clave_de_encriptacion
```

---

## TESTING DEL WORKFLOW

### Test Cases:

1. **Cliente Nuevo - Flujo Completo:**
   - Enviar mensaje nuevo desde Telegram
   - Verificar que solicita nombre y dirección
   - Completar registro
   - Hacer pedido
   - Verificar creación en Shopify

2. **Cliente Existente - Flujo Completo:**
   - Enviar mensaje desde cuenta conocida
   - Verificar saludo personalizado
   - Hacer pedido
   - Verificar que usa datos guardados

3. **Manejo de Errores:**
   - Pedido sin productos
   - Dirección inválida
   - Método de pago incorrecto

4. **Interrupciones:**
   - Cliente abandona a mitad del pedido
   - Cliente edita mensaje
   - Múltiples mensajes rápidos

---

## MONITOREO Y MÉTRICAS

### KPIs a Monitorear:

1. **Tasa de conversión:** Mensajes → Pedidos completados
2. **Tiempo promedio:** Inicio conversación → Pedido creado
3. **Tasa de error:** Pedidos fallidos / Total pedidos
4. **Clientes nuevos:** Por día/semana/mes
5. **Método de pago preferido:** Efectivo vs Transferencia

---

## PRÓXIMOS PASOS

Una vez implementado este WF1, estarás listo para:

1. ✅ **WF2:** Validación de Pagos (comprobantes fotográficos)
2. ✅ **WF3:** Reportes Logísticos Automáticos
3. ✅ **WF4:** Optimización de Rutas
4. ✅ **WF5:** Seguimiento y Consultas de Estado

---

**Concebido por Romuald Członkowski - [AI Advisors](https://www.aiadvisors.pl/en)**
