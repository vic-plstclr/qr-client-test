const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios'); // Import axios
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
// Reemplaza 'YOUR_JSONBIN_ID' con el ID de tu bin de JSONBin.io
const JSON_DATA_URL = process.env.JSON_DATA_URL || 'https://api.jsonbin.io/v3/b/683bdfad8960c979a5a3b4b9'; 

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let products = [];
// Duración del caché de los productos (5 minutos)
const CACHE_DURATION_MS = 10 * 1000; 
let lastFetchTime = 0;

// Función auxiliar para normalizar UUIDs
// Elimina espacios en blanco y convierte a minúsculas para una comparación consistente
const normalizeUuid = (uuidString) => {
    if (typeof uuidString !== 'string') {
        return ''; 
    }
    return uuidString.trim().toLowerCase();
};

// Función para obtener los productos del JSONBin.io
const fetchProducts = async () => {
    const now = Date.now();
    // Solo se actualizan los productos si el caché ha expirado o si no se han cargado aún
    if (products.length === 0 || (now - lastFetchTime) > CACHE_DURATION_MS) {
        console.log('Fetching products from external JSON URL...');
        try {
            const headers = {
                'User-Agent': 'Node.js QR Service/1.0 (contact@misitio.com)',
            };

            const response = await axios.get(JSON_DATA_URL, { headers: headers });

            // JSONBin.io a menudo anida los datos bajo la clave 'record'.
            // Mapeamos los productos y normalizamos sus UUIDs al cargarlos.
            const rawProducts = response.data.record || response.data;

            if (!Array.isArray(rawProducts)) {
                console.error('Fetched data is not an array. Please check JSON structure. Data received:', JSON.stringify(response.data).substring(0, 200) + '...');
                products = [];
            } else {
                products = rawProducts.map(p => ({
                    ...p,
                    qr_uuid: normalizeUuid(p.qr_uuid) // Normaliza UUIDs de los datos obtenidos
                }));
            }

            console.log('Fetched products data (normalized):', products); 
            lastFetchTime = now;
            console.log(`Products loaded. Total: ${products.length}`);
        } catch (error) {
            console.error(`Error fetching products from ${JSON_DATA_URL}:`, error.message);
            if (error.response) {
                console.error('Error response data:', error.response.data);
                console.error('Error response status:', error.response.status);
                console.error('Error response headers:', error.response.headers);
            } else if (error.request) {
                console.error('Error request (no response received):', error.request);
            } else {
                console.error('Error config:', error.config);
            }
        }
    }
};

// Se obtienen los productos al iniciar el servidor y se refrescan periódicamente
fetchProducts();
setInterval(fetchProducts, CACHE_DURATION_MS);



// --- Route handling UUIDs ---
app.get('/:qr_uuid', async (req, res) => {
    // Original UUID from URL (this is what we test with regex)
    const originalUrlUuid = req.params.qr_uuid;

    // Normalize the UUID for comparison later
    const requestedUuid = normalizeUuid(originalUrlUuid); 

    console.log(`Request received for original UUID: '${originalUrlUuid}'`); // Log original
    console.log(`Request received for UUID (normalized): '${requestedUuid}'`); // Log normalized

    // Define the regex for UUID v4 format
    // This regex explicitly checks for the '4' in the third group for UUIDv4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // IMPORTANT CHANGE: Apply a basic trim before testing with the regex.
    // This removes any leading/trailing whitespace that might invalidate the regex match.
    // Also, use the normalized version for the regex test if your UUIDs in JSONBin.io might not be perfect casing.
    if (!uuidRegex.test(requestedUuid)) { // <--- CHANGE IS HERE: Test the normalized version
        console.log(`Access to URL with invalid UUID format: '${originalUrlUuid}' (Normalized: '${requestedUuid}')`);
        return res.status(404).render('404_product_not_found');
    }

    // Ensure products are loaded (or refresh if needed)
    await fetchProducts(); 

    console.log('Products array size:', products.length);
    console.log('--- UUID Comparison Debugging ---');
    console.log(`Requested UUID (normalized): '${requestedUuid}' (length: ${requestedUuid.length})`);

    let requestedCharCodes = '';
    for (let i = 0; i < requestedUuid.length; i++) {
        requestedCharCodes += requestedUuid.charCodeAt(i) + ' ';
    }
    console.log(`Requested UUID char codes: ${requestedCharCodes.trim()}`);


    products.forEach((p, index) => {
        const productUuid = p.qr_uuid; // Already normalized by fetchProducts
        console.log(`Product[${index}].qr_uuid (normalized from array): '${productUuid}' (length: ${productUuid.length})`);

        let productCharCodes = '';
        for (let i = 0; i < productUuid.length; i++) {
            productCharCodes += productUuid.charCodeAt(i) + ' ';
        }
        console.log(`Product[${index}].qr_uuid char codes: ${productCharCodes.trim()}`);
    });
    console.log('--- End UUID Comparison Debugging ---');


    // Realiza la búsqueda del producto usando los UUIDs normalizados
    const product = products.find(p => p.qr_uuid === requestedUuid);

    console.log('Found product:', product);

    if (product) {
        console.log(`Product found for UUID: ${requestedUuid}. Name: ${product.nombre}`);
        res.render('product_detail', { product: product});
    } else {
        console.log(`Product not found for UUID: ${requestedUuid}`);
        res.status(404).render('404_product_not_found');
    }
});

// Ruta de inicio
app.get('/', (req, res) => {
    res.send('Bienvenido al servicio de QR de misitio.com. Escanea un QR de producto para ver sus detalles.');
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`QR Server listening on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT} (for local development)`);
});