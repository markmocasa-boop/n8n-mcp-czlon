# WF1: Chatbot Principal con Agente IA y Tools (Arquitectura Moderna)

## 🎯 Concepto de la Nueva Arquitectura

En lugar de múltiples nodos con código JavaScript propenso a errores, **un único Agente de IA orquesta todo el flujo** usando **Tools especializados**.

### Ventajas de esta Arquitectura:

✅ **Sin código complejo** - El agente decide qué tools usar
✅ **Manejo inteligente de errores** - El agente adapta su comportamiento
✅ **Conversación natural** - El agente mantiene contexto automáticamente
✅ **Fácil de mantener** - Los tools son modulares y reutilizables
✅ **Escalable** - Agregar nuevas funcionalidades = agregar nuevos tools

---

## 📊 Nueva Arquitectura Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│            WORKFLOW 1: CHATBOT CON AGENTE IA Y TOOLS                │
└─────────────────────────────────────────────────────────────────────┘

[Telegram Trigger]
    ↓
[Code: Extraer Datos Básicos de Telegram]
    ↓
[Postgres: Verificar si Cliente Existe]
    ↓
[Code: Preparar Contexto Simple]
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    🤖 AGENTE IA ORQUESTADOR                      │
│                                                                  │
│  El agente decide qué hacer según la conversación:              │
│                                                                  │
│  Tools Disponibles:                                             │
│  ├─ 🗄️  Tool: Crear Cliente en PostgreSQL                       │
│  ├─ 🛒 Tool: Crear Orden en Shopify                            │
│  ├─ 💾 Tool: Registrar Pedido en PostgreSQL                     │
│  ├─ 💬 Tool: Enviar Mensaje a Telegram                         │
│  ├─ 📦 Tool: Consultar Catálogo de Productos                    │
│  ├─ 🔍 Tool: Buscar Estado de Pedido                           │
│  └─ ✅ Tool: Validar Información del Cliente                    │
│                                                                  │
│  Memoria de Conversación: Buffer Memory (por chatId)           │
└─────────────────────────────────────────────────────────────────┘
    ↓
[FIN - El agente maneja toda la lógica]
```

**IMPORTANTE:** Ya NO necesitamos:
- ❌ Múltiples nodos IF
- ❌ Múltiples nodos Code con validaciones
- ❌ Múltiples nodos Merge
- ❌ Lógica compleja de conexiones

**El agente decide dinámicamente qué tools usar según el contexto de la conversación.**

---

## 🔧 CONFIGURACIÓN DETALLADA DE CADA NODO

---

### NODO 1: Telegram Trigger
**Tipo:** `n8n-nodes-base.telegramTrigger`
**Nombre:** `Telegram Trigger - Mensajes Entrantes`

```json
{
  "updates": ["message"],
  "additionalFields": {
    "download": true,
    "includeTypes": ["message", "edited_message"]
  }
}
```

**Credentials:** Bot Token de @BotFather

---

### NODO 2: Code - Extraer Datos Básicos
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Normalizar Datos Telegram`

**Código JavaScript (simplificado):**

```javascript
const message = $input.item.json.message;

// Solo extraer lo esencial
return {
  phone: message.from?.id.toString() || null,
  userId: message.from?.id || null,
  userName: [message.from?.first_name, message.from?.last_name]
    .filter(Boolean).join(' ') || 'Cliente',
  username: message.from?.username || null,
  text: message.text || message.caption || '',
  chatId: message.chat.id,
  messageId: message.message_id,
  timestamp: new Date().toISOString()
};
```

**Salida:**
```json
{
  "phone": "987654321",
  "userId": 987654321,
  "userName": "Juan Pérez",
  "username": "juanperez",
  "text": "Hola, quiero hacer un pedido",
  "chatId": 987654321,
  "messageId": 12345,
  "timestamp": "2024-11-13T10:15:43.000Z"
}
```

---

### NODO 3: Postgres - Verificar Cliente Existe
**Tipo:** `n8n-nodes-base.postgres`
**Nombre:** `Postgres - Buscar Cliente`

**SQL Query:**
```sql
SELECT
  id,
  phone,
  name,
  address,
  email,
  total_orders,
  last_order_date
FROM customers
WHERE phone = $1
LIMIT 1;
```

**Parámetros:**
- $1: `={{ $json.phone }}`

**Salida (si existe):**
```json
{
  "id": 42,
  "phone": "987654321",
  "name": "Juan Pérez",
  "address": "Av. Corrientes 1234, CABA",
  "email": "juan@email.com",
  "total_orders": 5,
  "last_order_date": "2024-11-01T16:45:00.000Z"
}
```

**Salida (si NO existe):**
```json
{}
```

---

### NODO 4: Code - Preparar Contexto para el Agente
**Tipo:** `n8n-nodes-base.code`
**Nombre:** `Code - Contexto Simple para Agente`

**Código JavaScript:**

```javascript
const telegramData = $('Code - Normalizar Datos Telegram').item.json;
const customerData = $input.item.json;

// Verificar si el cliente existe
const customerExists = !!customerData.id;

// Preparar contexto simple para el agente
const context = {
  // Datos de Telegram
  phone: telegramData.phone,
  userId: telegramData.userId,
  userName: telegramData.userName,
  username: telegramData.username,
  chatId: telegramData.chatId,
  messageId: telegramData.messageId,

  // Mensaje del usuario
  userMessage: telegramData.text,

  // Estado del cliente
  customerExists: customerExists,

  // Datos del cliente (si existe)
  customer: customerExists ? {
    id: customerData.id,
    name: customerData.name,
    address: customerData.address,
    email: customerData.email,
    totalOrders: customerData.total_orders,
    lastOrderDate: customerData.last_order_date
  } : null
};

return context;
```

**Salida (Cliente Existente):**
```json
{
  "phone": "987654321",
  "userId": 987654321,
  "userName": "Juan Pérez",
  "chatId": 987654321,
  "messageId": 12345,
  "userMessage": "Hola, quiero hacer un pedido",
  "customerExists": true,
  "customer": {
    "id": 42,
    "name": "Juan Pérez",
    "address": "Av. Corrientes 1234, CABA",
    "email": "juan@email.com",
    "totalOrders": 5,
    "lastOrderDate": "2024-11-01T16:45:00.000Z"
  }
}
```

**Salida (Cliente Nuevo):**
```json
{
  "phone": "987654321",
  "userId": 987654321,
  "userName": "Juan",
  "chatId": 987654321,
  "messageId": 12345,
  "userMessage": "Hola, quiero hacer un pedido",
  "customerExists": false,
  "customer": null
}
```

---

### NODO 5: 🤖 AI AGENT - Orquestador Principal
**Tipo:** `@n8n/n8n-nodes-langchain.agent`
**Nombre:** `AI Agent - Orquestador de Ventas`

Este es el nodo más importante del workflow. El agente usa **Tools** para ejecutar acciones.

---

## 🛠️ TOOLS DEL AGENTE (Sub-Nodos)

El agente tiene acceso a estos 7 tools especializados:

---

### TOOL 1: 🗄️ Crear Cliente en PostgreSQL
**Tipo:** `@n8n/n8n-nodes-langchain.toolWorkflow`
**Nombre:** `Tool: Crear Cliente`

**Descripción para el Agente:**
```
Crea un nuevo cliente en la base de datos PostgreSQL.

Usa este tool SOLO cuando:
- El cliente es nuevo (customerExists es false)
- Ya has recopilado nombre completo y dirección completa del cliente

Parámetros requeridos:
- phone: string (teléfono/ID del cliente)
- name: string (nombre completo del cliente)
- address: string (dirección completa de envío)
- email: string (opcional)
- telegram_username: string (opcional)
- telegram_user_id: number (ID de Telegram)

Retorna: El ID del nuevo cliente creado
```

**Workflow Vinculado: Sub-Workflow "Crear Cliente"**

**Configuración del Sub-Workflow:**

```json
{
  "nodes": [
    {
      "name": "Execute Workflow Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger"
    },
    {
      "name": "Postgres - Insert Customer",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO customers (phone, name, address, email, telegram_username, telegram_user_id, created_at, total_orders, source) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0, 'telegram') RETURNING id, phone, name, address, email",
        "additionalFields": {}
      }
    },
    {
      "name": "Format Response",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return { success: true, customerId: $input.item.json.id, message: 'Cliente creado exitosamente' };"
      }
    }
  ]
}
```

**Parámetros de entrada esperados:**
```json
{
  "phone": "987654321",
  "name": "Juan Carlos Pérez",
  "address": "Av. Corrientes 1234, Piso 5, CABA, C1043",
  "email": "juan@email.com",
  "telegram_username": "juanperez",
  "telegram_user_id": 987654321
}
```

**Salida del Tool:**
```json
{
  "success": true,
  "customerId": 43,
  "message": "Cliente creado exitosamente"
}
```

---

### TOOL 2: 🛒 Crear Orden en Shopify
**Tipo:** `@n8n/n8n-nodes-langchain.toolWorkflow`
**Nombre:** `Tool: Crear Orden Shopify`

**Descripción para el Agente:**
```
Crea una orden en Shopify con los productos del pedido.

Usa este tool cuando:
- El pedido está completo (productos, dirección, método de pago)
- Ya has validado toda la información

Parámetros requeridos:
- customer_phone: string
- customer_name: string
- shipping_address: string
- products: array de objetos [{name, quantity, price}]
- payment_method: string ("efectivo" o "transferencia")
- comments: string (opcional)

Retorna: El número de orden de Shopify y el ID
```

**Sub-Workflow:**

```json
{
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger"
    },
    {
      "name": "Shopify - Create Order",
      "type": "n8n-nodes-base.shopify",
      "parameters": {
        "resource": "order",
        "operation": "create",
        "additionalFields": {
          "phone": "={{ $json.customer_phone }}",
          "shippingAddress": {
            "address1": "={{ $json.shipping_address }}",
            "phone": "={{ $json.customer_phone }}",
            "firstName": "={{ $json.customer_name.split(' ')[0] }}",
            "lastName": "={{ $json.customer_name.split(' ').slice(1).join(' ') }}"
          },
          "lineItems": "={{ $json.products }}",
          "financialStatus": "pending",
          "tags": "telegram,{{ $json.payment_method }},ai-agent",
          "note": "Método de pago: {{ $json.payment_method }}\nComentarios: {{ $json.comments }}"
        }
      }
    },
    {
      "name": "Format Response",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return { success: true, shopifyOrderId: $input.item.json.id, orderNumber: $input.item.json.order_number, totalPrice: $input.item.json.total_price };"
      }
    }
  ]
}
```

**Entrada:**
```json
{
  "customer_phone": "987654321",
  "customer_name": "Juan Carlos Pérez",
  "shipping_address": "Av. Corrientes 1234, Piso 5, CABA",
  "products": [
    {"name": "Producto A", "quantity": 2, "price": 1500}
  ],
  "payment_method": "transferencia",
  "comments": "Entregar por la mañana"
}
```

**Salida:**
```json
{
  "success": true,
  "shopifyOrderId": 5678901234,
  "orderNumber": 8766,
  "totalPrice": "3000.00"
}
```

---

### TOOL 3: 💾 Registrar Pedido en PostgreSQL
**Tipo:** `@n8n/n8n-nodes-langchain.toolWorkflow`
**Nombre:** `Tool: Registrar Pedido`

**Descripción para el Agente:**
```
Guarda el pedido en la base de datos PostgreSQL para seguimiento interno.

Usa este tool después de crear la orden en Shopify.

Parámetros requeridos:
- customer_id: number (ID del cliente en BD)
- shopify_order_id: number
- shopify_order_number: number
- payment_method: string
- total_amount: number
- order_details: object (detalles completos del pedido)
- telegram_chat_id: number

Retorna: Confirmación de registro
```

**Sub-Workflow:**

```json
{
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger"
    },
    {
      "name": "Postgres - Insert Order",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO orders (customer_id, shopify_order_id, shopify_order_number, payment_method, payment_status, delivery_status, total_amount, order_details, telegram_chat_id, created_at) VALUES ($1, $2, $3, $4, 'pending', 'not_delivered', $5, $6::jsonb, $7, NOW()) RETURNING id, shopify_order_number"
      }
    },
    {
      "name": "Format Response",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return { success: true, orderId: $input.item.json.id, message: 'Pedido registrado en base de datos' };"
      }
    }
  ]
}
```

---

### TOOL 4: 💬 Enviar Mensaje a Telegram
**Tipo:** `@n8n/n8n-nodes-langchain.toolWorkflow`
**Nombre:** `Tool: Enviar Mensaje Telegram`

**Descripción para el Agente:**
```
Envía un mensaje al cliente por Telegram.

Usa este tool para:
- Responder preguntas del cliente
- Enviar confirmaciones de pedido
- Enviar instrucciones de pago
- Cualquier comunicación con el cliente

Parámetros requeridos:
- chat_id: number (ID del chat de Telegram)
- message: string (mensaje a enviar)
- parse_mode: string (opcional, "Markdown" por defecto)

Retorna: Confirmación de envío
```

**Sub-Workflow:**

```json
{
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger"
    },
    {
      "name": "Telegram - Send Message",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "resource": "message",
        "operation": "sendMessage",
        "chatId": "={{ $json.chat_id }}",
        "text": "={{ $json.message }}",
        "additionalFields": {
          "parse_mode": "={{ $json.parse_mode || 'Markdown' }}"
        }
      }
    },
    {
      "name": "Format Response",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return { success: true, message: 'Mensaje enviado exitosamente' };"
      }
    }
  ]
}
```

---

### TOOL 5: 📦 Consultar Catálogo de Productos
**Tipo:** `@n8n/n8n-nodes-langchain.toolCode`
**Nombre:** `Tool: Catálogo de Productos`

**Descripción para el Agente:**
```
Obtiene la lista de productos disponibles con precios.

Usa este tool cuando el cliente pregunte:
- "¿Qué productos tienen?"
- "¿Cuánto cuesta...?"
- "Quiero ver el catálogo"

No requiere parámetros.

Retorna: Lista de productos con nombres y precios
```

**Configuración del Tool Code:**

```json
{
  "name": "consultar_catalogo",
  "description": "Obtiene el catálogo completo de productos disponibles con sus precios. Úsalo cuando el cliente quiera ver qué productos hay disponibles.",
  "language": "javaScript",
  "code": "// Catálogo de productos (puedes hacerlo dinámico con una consulta a BD)\nconst catalogo = [\n  { id: 1, name: 'Producto A', price: 1500, description: 'Descripción del producto A', stock: 50 },\n  { id: 2, name: 'Producto B', price: 2200, description: 'Descripción del producto B', stock: 30 },\n  { id: 3, name: 'Producto C', price: 850, description: 'Descripción del producto C', stock: 100 },\n  { id: 4, name: 'Producto D', price: 3500, description: 'Descripción del producto D', stock: 20 }\n];\n\nreturn { productos: catalogo, total: catalogo.length };",
  "specifyInputSchema": false
}
```

**Salida:**
```json
{
  "productos": [
    {"id": 1, "name": "Producto A", "price": 1500, "description": "...", "stock": 50},
    {"id": 2, "name": "Producto B", "price": 2200, "description": "...", "stock": 30}
  ],
  "total": 4
}
```

---

### TOOL 6: 🔍 Buscar Estado de Pedido
**Tipo:** `@n8n/n8n-nodes-langchain.toolWorkflow`
**Nombre:** `Tool: Consultar Estado Pedido`

**Descripción para el Agente:**
```
Busca el estado actual de un pedido del cliente.

Usa este tool cuando el cliente pregunte:
- "¿Dónde está mi pedido?"
- "Estado del pedido #8766"
- "Quiero saber si ya enviaron mi pedido"

Parámetros:
- order_number: string (número del pedido, opcional)
- customer_phone: string (si no hay número de pedido, busca el último)

Retorna: Estado del pago y envío del pedido
```

**Sub-Workflow:**

```sql
SELECT
  o.shopify_order_number,
  o.payment_status,
  o.delivery_status,
  o.total_amount,
  o.created_at,
  o.payment_method,
  c.name as customer_name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE (o.shopify_order_number = $1 OR $1 IS NULL)
  AND (c.phone = $2 OR $2 IS NULL)
ORDER BY o.created_at DESC
LIMIT 1;
```

---

### TOOL 7: ✅ Validar Información del Cliente
**Tipo:** `@n8n/n8n-nodes-langchain.toolCode`
**Nombre:** `Tool: Validar Datos Cliente`

**Descripción para el Agente:**
```
Valida que la información del cliente esté completa y correcta.

Usa este tool antes de crear un pedido para verificar que tienes:
- Nombre completo (mínimo 2 palabras)
- Dirección completa (mínimo 10 caracteres)
- Método de pago válido ("efectivo" o "transferencia")

Parámetros:
- name: string
- address: string
- payment_method: string

Retorna: Validación con errores si los hay
```

**Código del Tool:**

```javascript
const { name, address, payment_method } = $input;

const errors = [];

// Validar nombre
if (!name || name.trim().split(' ').length < 2) {
  errors.push('El nombre completo debe incluir nombre y apellido');
}

// Validar dirección
if (!address || address.trim().length < 10) {
  errors.push('La dirección debe ser completa (calle, número, ciudad, código postal)');
}

// Validar método de pago
const validMethods = ['efectivo', 'transferencia'];
if (!payment_method || !validMethods.includes(payment_method.toLowerCase())) {
  errors.push('El método de pago debe ser "efectivo" o "transferencia"');
}

return {
  valid: errors.length === 0,
  errors: errors,
  message: errors.length === 0 ? 'Información válida' : 'Hay errores en la información'
};
```

**Schema del Input:**
```json
{
  "type": "object",
  "properties": {
    "name": {"type": "string", "description": "Nombre completo del cliente"},
    "address": {"type": "string", "description": "Dirección completa de envío"},
    "payment_method": {"type": "string", "description": "Método de pago elegido"}
  },
  "required": ["name", "address", "payment_method"]
}
```

---

## 🤖 CONFIGURACIÓN DEL AGENTE PRINCIPAL

### System Prompt del Agente Orquestador:

```
Eres un asistente de ventas experto para una tienda de comercio electrónico conectada a Shopify. Usas TOOLS para ejecutar acciones específicas.

═══════════════════════════════════════════════════════════════

📊 CONTEXTO DEL CLIENTE ACTUAL:
{{ JSON.stringify($json, null, 2) }}

═══════════════════════════════════════════════════════════════

🎯 TU MISIÓN:

1. **SI EL CLIENTE ES NUEVO (customerExists: false):**
   - Saluda amablemente y explica que necesitas recopilar algunos datos
   - Recopila en ESTE ORDEN:
     a) Nombre completo (nombre y apellido)
     b) Dirección de envío completa (calle, número, piso/depto si aplica, ciudad, código postal)
   - Usa el tool "Tool: Validar Datos Cliente" para verificar que la info esté completa
   - Usa el tool "Tool: Crear Cliente" para registrarlo en la base de datos
   - SOLO después de crear el cliente, procede con el pedido

2. **SI EL CLIENTE YA EXISTE (customerExists: true):**
   - Salúdalo por su nombre
   - Menciona cuántos pedidos ha hecho (customer.totalOrders)
   - Confirma si la dirección guardada sigue siendo válida: {{ $json.customer.address }}
   - Si quiere cambiar la dirección, actualízala

3. **PARA TODOS LOS CLIENTES - GESTIONAR EL PEDIDO:**
   - Usa el tool "Tool: Catálogo de Productos" para mostrar productos disponibles
   - Recopila los productos que desea (nombre, cantidad)
   - Pregunta el método de pago: "efectivo" o "transferencia"
   - Recopila comentarios adicionales (opcional)
   - Confirma TODOS los detalles del pedido antes de crearlo

4. **CUANDO EL PEDIDO ESTÉ COMPLETO:**
   - Usa el tool "Tool: Validar Datos Cliente" para verificar todo
   - Usa el tool "Tool: Crear Orden Shopify" para crear la orden
   - Usa el tool "Tool: Registrar Pedido" para guardar en la base de datos
   - Usa el tool "Tool: Enviar Mensaje Telegram" para enviar la confirmación

5. **SI EL CLIENTE CONSULTA ESTADO:**
   - Usa el tool "Tool: Consultar Estado Pedido" para buscar su pedido
   - Informa claramente el estado del pago y envío

═══════════════════════════════════════════════════════════════

⚠️ REGLAS IMPORTANTES:

1. **SIEMPRE usa los TOOLS** - NO intentes ejecutar acciones directamente
2. **Valida antes de crear** - Usa "Tool: Validar Datos Cliente" antes de crear pedidos
3. **Confirma con el cliente** - Resume el pedido completo antes de crearlo
4. **Maneja errores** - Si un tool falla, informa al cliente y pide que intente de nuevo
5. **Sé conversacional** - Mantén un tono amigable y profesional
6. **Mantén contexto** - La memoria de chat te ayuda a recordar la conversación

═══════════════════════════════════════════════════════════════

💡 EJEMPLOS DE USO DE TOOLS:

**Ejemplo 1: Cliente nuevo hace un pedido**
1. Cliente dice: "Hola, quiero hacer un pedido"
2. Tú: "¡Hola! Veo que es tu primera vez. Necesito tu nombre completo y dirección."
3. Cliente: "Juan Carlos Pérez, Av. Corrientes 1234, Piso 5, CABA, C1043"
4. Tú: [Usas Tool: Validar Datos Cliente] → válido
5. Tú: [Usas Tool: Crear Cliente] → cliente creado con ID 43
6. Tú: "¡Perfecto! ¿Qué productos te interesan?"
7. Cliente: "Quiero 2 unidades del Producto A"
8. Tú: [Usas Tool: Catálogo de Productos] → Producto A cuesta $1500
9. Tú: "Perfecto, 2 unidades del Producto A ($3000). ¿Pagas en efectivo o transferencia?"
10. Cliente: "Transferencia"
11. Tú: [Usas Tool: Crear Orden Shopify] → orden #8766 creada
12. Tú: [Usas Tool: Registrar Pedido] → guardado en BD
13. Tú: [Usas Tool: Enviar Mensaje Telegram] → confirmación enviada

**Ejemplo 2: Cliente existente consulta estado**
1. Cliente: "¿Dónde está mi pedido #8766?"
2. Tú: [Usas Tool: Consultar Estado Pedido con order_number: "8766"]
3. Tú: "Tu pedido #8766 está: Pago validado ✅, En preparación 📦"

═══════════════════════════════════════════════════════════════

🚀 AHORA PROCESA EL MENSAJE DEL CLIENTE Y USA LOS TOOLS SEGÚN SEA NECESARIO.

Mensaje del cliente: {{ $json.userMessage }}
```

---

### Configuración del Chat Model:

```json
{
  "model": "gpt-4o",
  "options": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

---

### Configuración de la Memoria:

**Tipo:** `@n8n/n8n-nodes-langchain.memoryBufferWindow`

```json
{
  "sessionKey": "={{ $json.chatId }}",
  "contextWindowLength": 15
}
```

**Función:** Mantiene las últimas 15 interacciones de cada chat para contexto.

---

## 📋 RESUMEN DEL FLUJO COMPLETO

```
1. [Telegram Trigger]
   Recibe mensaje del cliente
   ↓
2. [Code]
   Extrae datos básicos (phone, userName, text, chatId)
   ↓
3. [Postgres]
   Busca si el cliente existe en BD
   ↓
4. [Code]
   Prepara contexto simple: { customerExists: true/false, customer: {...} }
   ↓
5. [AI Agent con 7 Tools]
   El agente decide qué hacer:

   🔹 Cliente nuevo?
      → Tool: Validar Datos
      → Tool: Crear Cliente
      → Tool: Consultar Catálogo
      → Tool: Crear Orden Shopify
      → Tool: Registrar Pedido
      → Tool: Enviar Mensaje Telegram

   🔹 Cliente existente?
      → Tool: Consultar Catálogo
      → Tool: Crear Orden Shopify
      → Tool: Registrar Pedido
      → Tool: Enviar Mensaje Telegram

   🔹 Cliente consulta estado?
      → Tool: Buscar Estado Pedido
      → Tool: Enviar Mensaje Telegram

   El agente DECIDE DINÁMICAMENTE qué tools usar según la conversación
   ↓
6. [FIN]
   El agente maneja toda la lógica
```

---

## 🎨 VENTAJAS DE ESTA ARQUITECTURA

### ✅ Comparación con la arquitectura anterior:

| Aspecto | Arquitectura Anterior | Nueva Arquitectura con Tools |
|---------|----------------------|------------------------------|
| **Nodos totales** | 16 nodos | 5 nodos + 7 tools |
| **Código JavaScript** | ~500 líneas | ~100 líneas |
| **Mantenibilidad** | Difícil (código disperso) | Fácil (tools modulares) |
| **Manejo de errores** | Manual en cada nodo | Automático por el agente |
| **Flexibilidad** | Rígida (flujo fijo) | Dinámica (agente decide) |
| **Agregar funcionalidad** | Modificar múltiples nodos | Agregar un nuevo tool |
| **Testing** | Complejo | Simple (test por tool) |
| **Escalabilidad** | Limitada | Alta |

---

## 🚀 EJEMPLO DE CONVERSACIÓN REAL

### Caso 1: Cliente Nuevo

**Cliente:** "Hola, quiero hacer un pedido"

**Agente:** (Verifica customerExists: false)
> ¡Hola! Veo que es tu primera vez con nosotros 👋
>
> Para procesar tu pedido, necesito algunos datos:
> 1. Tu nombre completo
> 2. Tu dirección de envío completa
>
> ¿Podrías proporcionarme esta información?

**Cliente:** "Juan Carlos Pérez, Av. Corrientes 1234, Piso 5 Dto A, CABA, Buenos Aires, C1043"

**Agente:** (Usa Tool: Validar Datos Cliente) ✅
> (Usa Tool: Crear Cliente) → Cliente ID 43 creado
>
> ¡Perfecto Juan Carlos! Ya tienes tu cuenta registrada.
>
> Déjame mostrarte nuestros productos disponibles...
> (Usa Tool: Catálogo de Productos)
>
> 📦 Productos disponibles:
> • Producto A - $1,500
> • Producto B - $2,200
> • Producto C - $850
> • Producto D - $3,500
>
> ¿Qué te gustaría ordenar?

**Cliente:** "Quiero 2 unidades del Producto A"

**Agente:**
> Perfecto! 2 unidades del Producto A = $3,000
>
> ¿Cómo te gustaría pagar?
> 1. Efectivo o tarjeta en el momento de la entrega
> 2. Transferencia bancaria

**Cliente:** "Transferencia"

**Agente:**
> Excelente. Déjame confirmar tu pedido:
>
> 📦 Productos: Producto A x2
> 💰 Total: $3,000
> 📍 Dirección: Av. Corrientes 1234, Piso 5 Dto A, CABA
> 💳 Pago: Transferencia bancaria
>
> ¿Confirmas el pedido?

**Cliente:** "Sí, confirmo"

**Agente:** (Ejecuta secuencia de tools)
> 1. (Usa Tool: Crear Orden Shopify) → Orden #8766 creada ✅
> 2. (Usa Tool: Registrar Pedido) → Guardado en BD ✅
> 3. (Usa Tool: Enviar Mensaje Telegram) con confirmación detallada:

```
✅ ¡PEDIDO CREADO EXITOSAMENTE!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 NÚMERO DE PEDIDO: #8766
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 CLIENTE: Juan Carlos Pérez
📍 DIRECCIÓN: Av. Corrientes 1234, Piso 5 Dto A, CABA

🛒 PRODUCTOS:
1. Producto A x2 - $3000

💰 TOTAL: $3,000

🏦 MÉTODO DE PAGO: Transferencia Bancaria

📸 IMPORTANTE: Para procesar tu pedido, envía el comprobante:
   • Por este chat (foto), O
   • Por email a: pagos@tutienda.com

Datos bancarios:
🏦 Banco: Banco Nación
👤 Titular: Tu Tienda SRL
💳 CBU: 0110000000000000000000
💰 Monto: $3,000
📝 Referencia: Pedido #8766

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ESTADO ACTUAL:
• Pago: ⏳ Pendiente de validación
• Envío: 📦 Preparando

¡Gracias por tu compra! 🙏
```

---

### Caso 2: Cliente Existente Consulta Estado

**Cliente:** "Hola, ¿dónde está mi pedido #8766?"

**Agente:** (Usa Tool: Consultar Estado Pedido con order_number: "8766")
```json
{
  "shopify_order_number": 8766,
  "payment_status": "paid",
  "delivery_status": "in_route",
  "total_amount": 3000,
  "created_at": "2024-11-13T11:35:00Z",
  "payment_method": "transferencia"
}
```

**Agente:** (Usa Tool: Enviar Mensaje Telegram)
> ¡Hola! 👋
>
> Tu pedido #8766 está en camino 🚚
>
> 📊 Estado actual:
> • Pago: ✅ VALIDADO
> • Envío: 🚛 EN RUTA
>
> Tu pedido llegará hoy dentro de las próximas horas.
>
> ¿Necesitas algo más?

---

## 🔧 CONFIGURACIÓN COMPLETA DEL WORKFLOW EN JSON

Para importar directamente en n8n:

```json
{
  "name": "WF1 - Chatbot con Agente IA y Tools",
  "nodes": [
    {
      "parameters": {
        "updates": ["message"],
        "additionalFields": {
          "download": true
        }
      },
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "jsCode": "const message = $input.item.json.message;\n\nreturn {\n  phone: message.from?.id.toString() || null,\n  userId: message.from?.id || null,\n  userName: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Cliente',\n  username: message.from?.username || null,\n  text: message.text || message.caption || '',\n  chatId: message.chat.id,\n  messageId: message.message_id,\n  timestamp: new Date().toISOString()\n};"
      },
      "name": "Code - Extraer Datos",
      "type": "n8n-nodes-base.code",
      "position": [450, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT id, phone, name, address, email, total_orders, last_order_date FROM customers WHERE phone = $1 LIMIT 1",
        "additionalFields": {}
      },
      "name": "Postgres - Buscar Cliente",
      "type": "n8n-nodes-base.postgres",
      "position": [650, 300]
    },
    {
      "parameters": {
        "jsCode": "const telegramData = $('Code - Extraer Datos').item.json;\nconst customerData = $input.item.json;\n\nconst customerExists = !!customerData.id;\n\nreturn {\n  phone: telegramData.phone,\n  userId: telegramData.userId,\n  userName: telegramData.userName,\n  username: telegramData.username,\n  chatId: telegramData.chatId,\n  messageId: telegramData.messageId,\n  userMessage: telegramData.text,\n  customerExists: customerExists,\n  customer: customerExists ? {\n    id: customerData.id,\n    name: customerData.name,\n    address: customerData.address,\n    email: customerData.email,\n    totalOrders: customerData.total_orders,\n    lastOrderDate: customerData.last_order_date\n  } : null\n};"
      },
      "name": "Code - Preparar Contexto",
      "type": "n8n-nodes-base.code",
      "position": [850, 300]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "VER SYSTEM PROMPT COMPLETO ARRIBA",
        "hasOutputParser": false,
        "options": {
          "systemMessage": "VER SYSTEM PROMPT COMPLETO ARRIBA"
        }
      },
      "name": "AI Agent - Orquestador",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "position": [1050, 300],
      "typeVersion": 1.6
    }
  ],
  "connections": {
    "Telegram Trigger": {
      "main": [[{ "node": "Code - Extraer Datos", "type": "main", "index": 0 }]]
    },
    "Code - Extraer Datos": {
      "main": [[{ "node": "Postgres - Buscar Cliente", "type": "main", "index": 0 }]]
    },
    "Postgres - Buscar Cliente": {
      "main": [[{ "node": "Code - Preparar Contexto", "type": "main", "index": 0 }]]
    },
    "Code - Preparar Contexto": {
      "main": [[{ "node": "AI Agent - Orquestador", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

---

## 📊 ESQUEMA DE BASE DE DATOS (MISMO)

```sql
-- Tabla de clientes
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  email VARCHAR(255),
  telegram_username VARCHAR(100),
  telegram_user_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_order_id INTEGER,
  total_orders INTEGER DEFAULT 0,
  last_order_date TIMESTAMP,
  customer_notes TEXT,
  source VARCHAR(50)
);

-- Tabla de pedidos
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  shopify_order_id VARCHAR(255) UNIQUE,
  shopify_order_number VARCHAR(50) UNIQUE,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_validated_at TIMESTAMP,
  delivery_status VARCHAR(50) DEFAULT 'not_delivered',
  total_amount DECIMAL(10,2),
  order_details JSONB,
  telegram_chat_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_orders_status ON orders(payment_status, delivery_status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

---

## 🎯 CONCLUSIÓN

Esta arquitectura con **Agente IA + Tools** es:

✅ **Más simple** - 5 nodos en lugar de 16
✅ **Más robusta** - El agente maneja errores automáticamente
✅ **Más flexible** - El agente adapta su comportamiento
✅ **Más mantenible** - Los tools son modulares
✅ **Más escalable** - Agregar funcionalidad = agregar tool

**El agente decide dinámicamente qué hacer según la conversación, eliminando la necesidad de código complejo y múltiples nodos IF/Merge.**

---

**Concebido por Romuald Członkowski - [AI Advisors](https://www.aiadvisors.pl/en)**
