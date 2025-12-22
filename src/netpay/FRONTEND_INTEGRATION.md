# Integración Frontend con NetpayJS

Esta guía explica cómo integrar NetpayJS en el frontend y conectarlo con el backend de NestJS.

## Flujo de Integración

1. **Frontend**: Usa NetpayJS para tokenizar la tarjeta del cliente
2. **Frontend**: Envía el token al backend
3. **Backend**: Procesa el pago usando el token

## Paso 1: Incluir NetpayJS en tu Frontend

### Opción A: CDN (Recomendado)

```html
<!DOCTYPE html>
<html>
<head>
    <script type="text/javascript" src="https://docs.netpay.mx/cdn/v1.3/netpay.min.js"></script>
</head>
<body>
    <!-- Tu formulario aquí -->
</body>
</html>
```

### Opción B: Descarga Local

Descarga `netpay.min.js` desde [Netpay CDN](https://docs.netpay.mx/cdn/v1.3/netpay.min.js) y guárdalo en tu proyecto.

## Paso 2: Obtener la Public Key del Backend

```javascript
// Obtener la public key desde tu backend
async function getNetpayPublicKey() {
    const response = await fetch('https://tu-api.com/netpay/public-key', {
        headers: {
            'Authorization': 'Bearer tu-jwt-token'
        }
    });
    const data = await response.json();
    return data.publicKey;
}
```

## Paso 3: Configurar NetpayJS

```javascript
// Configurar NetpayJS
const publicKey = await getNetpayPublicKey();
NetPay.setApiKey(publicKey);

// Configurar ambiente (sandbox o production)
NetPay.setSandboxMode(true); // true para sandbox, false para production
```

## Paso 4: Generar Device Fingerprint

El device fingerprint es necesario para 3DS 2.0. Debe generarse cuando se muestra el formulario de pago.

```javascript
// Generar device fingerprint
let deviceFingerPrint;
function generateDevice(callback) {
    deviceFingerPrint = NetPay.form.generateDeviceFingerPrint();
    callback();
}

generateDevice(function() {
    console.log('Device Fingerprint:', deviceFingerPrint);
    // Ahora puedes proceder con la tokenización
});
```

## Paso 5: Tokenizar la Tarjeta

```javascript
function tokenizeCard(cardData) {
    const cardInformation = {
        cardNumber: cardData.cardNumber,      // Ej: "4000000000000002"
        expMonth: cardData.expMonth,          // Ej: "04"
        expYear: cardData.expYear,            // Ej: "25"
        cvv2: cardData.cvv,                   // Ej: "999"
        vault: cardData.saveCard || false,    // true si quieres guardar la tarjeta
        simpleUse: !cardData.saveCard,        // false si vas a guardar la tarjeta
        deviceFingerPrint: deviceFingerPrint  // Requerido para 3DS 2.0
    };

    // Validar datos de la tarjeta
    const validateNumber = NetPay.card.validateNumber(cardInformation.cardNumber);
    const validateExpiry = NetPay.card.validateExpiry(cardInformation.expMonth, cardInformation.expYear);
    const validateCVV = NetPay.card.validateCVV(cardInformation.cvv2, cardInformation.cardNumber);
    const validateNumberLength = NetPay.card.validateNumberLength(cardInformation.cardNumber);

    if (!validateNumberLength || !validateNumber || !validateExpiry || !validateCVV) {
        alert("Por favor, verifica los datos de tu tarjeta");
        return;
    }

    // Crear token
    NetPay.token.create(cardInformation, successCallback, errorCallback);
}

function successCallback(response) {
    if (response.status === 'success') {
        const token = response.data.token;
        const deviceInformation = NetPay.form.deviceInformation();
        
        // Enviar token al backend para procesar el pago
        processPayment({
            token: token,
            deviceFingerPrint: deviceFingerPrint,
            deviceInformation: deviceInformation,
            sessionId: deviceFingerPrint // sessionId es igual al deviceFingerPrint
        });
    } else {
        console.error('Error al tokenizar:', response);
    }
}

function errorCallback(error) {
    console.error('Error al tokenizar la tarjeta:', error);
    alert('Error al procesar la tarjeta. Por favor, intenta de nuevo.');
}
```

## Paso 6: Enviar Token al Backend

```javascript
async function processPayment(tokenData) {
    try {
        const paymentData = {
            token: tokenData.token,
            amount: 100.50, // Monto del pago
            currency: 'MXN',
            description: 'Pago de servicio de transporte',
            deviceFingerPrint: tokenData.deviceFingerPrint,
            deviceInformation: tokenData.deviceInformation,
            sessionId: tokenData.sessionId,
            saveCard: false, // true si quieres guardar la tarjeta
            billing: {
                firstName: 'Juan',
                lastName: 'Pérez',
                email: 'juan@example.com',
                phone: '+521234567890'
            }
        };

        const response = await fetch('https://tu-api.com/netpay/payment/with-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer tu-jwt-token'
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('Pago procesado exitosamente:', result);
            // Redirigir a página de éxito o mostrar mensaje
        } else {
            console.error('Error al procesar el pago:', result);
            alert('Error al procesar el pago: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el pago. Por favor, intenta de nuevo.');
    }
}
```

## Ejemplo Completo (HTML + JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
    <title>Pago con Netpay</title>
    <script type="text/javascript" src="https://docs.netpay.mx/cdn/v1.3/netpay.min.js"></script>
</head>
<body>
    <form id="paymentForm">
        <input type="text" id="cardNumber" placeholder="Número de tarjeta" />
        <input type="text" id="expMonth" placeholder="MM" maxlength="2" />
        <input type="text" id="expYear" placeholder="YY" maxlength="2" />
        <input type="text" id="cvv" placeholder="CVV" maxlength="4" />
        <label>
            <input type="checkbox" id="saveCard" /> Guardar tarjeta
        </label>
        <button type="submit">Pagar</button>
    </form>

    <script>
        let deviceFingerPrint;
        const API_BASE_URL = 'https://tu-api.com';
        const JWT_TOKEN = 'tu-jwt-token';

        // Inicializar NetpayJS
        async function initNetpay() {
            // Obtener public key del backend
            const response = await fetch(`${API_BASE_URL}/netpay/public-key`, {
                headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
            });
            const { publicKey } = await response.json();

            NetPay.setApiKey(publicKey);
            NetPay.setSandboxMode(true); // Cambiar a false en producción

            // Generar device fingerprint
            deviceFingerPrint = NetPay.form.generateDeviceFingerPrint();
        }

        // Manejar envío del formulario
        document.getElementById('paymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const cardData = {
                cardNumber: document.getElementById('cardNumber').value,
                expMonth: document.getElementById('expMonth').value,
                expYear: document.getElementById('expYear').value,
                cvv: document.getElementById('cvv').value,
                saveCard: document.getElementById('saveCard').checked
            };

            tokenizeCard(cardData);
        });

        function tokenizeCard(cardData) {
            const cardInformation = {
                cardNumber: cardData.cardNumber,
                expMonth: cardData.expMonth,
                expYear: cardData.expYear,
                cvv2: cardData.cvv,
                vault: cardData.saveCard,
                simpleUse: !cardData.saveCard,
                deviceFingerPrint: deviceFingerPrint
            };

            // Validaciones
            if (!NetPay.card.validateNumber(cardInformation.cardNumber) ||
                !NetPay.card.validateExpiry(cardInformation.expMonth, cardInformation.expYear) ||
                !NetPay.card.validateCVV(cardInformation.cvv2, cardInformation.cardNumber)) {
                alert("Por favor, verifica los datos de tu tarjeta");
                return;
            }

            NetPay.token.create(cardInformation, handleTokenSuccess, handleTokenError);
        }

        function handleTokenSuccess(response) {
            if (response.status === 'success') {
                const deviceInformation = NetPay.form.deviceInformation();
                processPayment({
                    token: response.data.token,
                    deviceFingerPrint: deviceFingerPrint,
                    deviceInformation: deviceInformation,
                    sessionId: deviceFingerPrint
                });
            }
        }

        function handleTokenError(error) {
            console.error('Error al tokenizar:', error);
            alert('Error al procesar la tarjeta. Por favor, intenta de nuevo.');
        }

        async function processPayment(tokenData) {
            try {
                const response = await fetch(`${API_BASE_URL}/netpay/payment/with-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${JWT_TOKEN}`
                    },
                    body: JSON.stringify({
                        token: tokenData.token,
                        amount: 100.50,
                        currency: 'MXN',
                        description: 'Pago de servicio',
                        deviceFingerPrint: tokenData.deviceFingerPrint,
                        deviceInformation: tokenData.deviceInformation,
                        sessionId: tokenData.sessionId,
                        saveCard: false
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Pago procesado exitosamente');
                    console.log('Resultado:', result);
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al procesar el pago');
            }
        }

        // Inicializar al cargar la página
        initNetpay();
    </script>
</body>
</html>
```

## Notas Importantes

1. **Seguridad**: Nunca envíes datos de tarjeta directamente al backend. Siempre usa NetpayJS para tokenizar.

2. **3DS 2.0**: Para que funcione correctamente, asegúrate de incluir:
   - `deviceFingerPrint`
   - `deviceInformation`
   - `sessionId` (igual al `deviceFingerPrint`)

3. **Guardar Tarjeta**: 
   - Si `saveCard: true`, establece `simpleUse: false` en la tokenización
   - Si `saveCard: false`, establece `simpleUse: true` en la tokenización

4. **Ambiente**: 
   - Sandbox: `NetPay.setSandboxMode(true)`
   - Production: `NetPay.setSandboxMode(false)`

## Endpoints del Backend Disponibles

- `GET /netpay/public-key` - Obtiene la public key para NetpayJS
- `POST /netpay/payment/with-token` - Procesa un pago con token generado por NetpayJS
- `GET /netpay/test-connection` - Verifica conectividad con Netpay
