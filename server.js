const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs'); // Para leer el archivo JSON
const { v4: uuidv4 } = require('uuid'); // Necesario si fueras a generar UUIDs aquí, pero lo haremos manualmente por ahora.

const PORT = process.env.PORT || 3000;

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Apunta a la carpeta 'views'

// Middleware para servir archivos estáticos (si tuvieras CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public'))); // Crea una carpeta 'public' si la necesitas

// Middleware para parsear JSON en las peticiones (si necesitaras POST)
app.use(express.json());

// --- Cargar productos desde el JSON ---
let products = [];
const productsFilePath = path.join(__dirname, 'products.json');

// Función para cargar los productos del JSON
const loadProducts = () => {
    try {
        const data = fs.readFileSync(productsFilePath, 'utf8');
        products = JSON.parse(data);
        console.log(`Productos cargados desde ${productsFilePath}. Total: ${products.length}`);
    } catch (error) {
        console.error(`Error al cargar productos desde ${productsFilePath}:`, error.message);
        products = []; // Inicializa como array vacío si hay un error
    }
};

// Cargar los productos al iniciar el servidor
loadProducts();

// --- Ruta principal para manejar los UUIDs ---
app.get('/:qr_uuid', (req, res) => {
    const qrUuid = req.params.qr_uuid;

    // --- Validación básica del UUID (opcional pero recomendada) ---
    // Un UUID v4 tiene el formato xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(qrUuid)) {
        console.log(`Acceso a URL con UUID inválido: ${qrUuid}`);
        return res.status(404).render('404_product_not_found');
    }

    // --- Buscar el producto en nuestro array cargado desde el JSON ---
    const product = products.find(p => p.qr_uuid === qrUuid);

    if (product) {
        // Si el producto se encuentra, renderiza la página de detalle
        console.log(`Producto encontrado para UUID: ${qrUuid}. Nombre: ${product.nombre}`);
        res.render('product_detail', { product: product });
    } else {
        // Si el producto no se encuentra
        console.log(`Producto no encontrado para UUID: ${qrUuid}`);
        res.status(404).render('404_product_not_found');
    }
});

// --- Manejo de ruta raíz (opcional, para cuando alguien accede solo a qr.misitio.com) ---
app.get('/', (req, res) => {
    res.send('Bienvenido al servicio de QR de misitio.com. Escanea un QR de producto para ver sus detalles.');
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`Servidor QR escuchando en el puerto ${PORT}`);
    console.log(`Acceso a: http://localhost:${PORT} (para desarrollo local)`);
});