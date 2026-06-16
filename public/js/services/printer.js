// Bluetooth Printer Service for TECHSQUARE POS
// Uses Web Bluetooth API to connect to receipt printers and send ESC/POS commands

import { toast } from '../ui/toast.js';
import { money, formatDate } from '../utils.js';
import { STORE1_ID, STORE2_ID } from '../config.js';

// Printer state
let printerDevice = null;
let printerCharacteristic = null;
let isConnected = false;

// ESC/POS Commands
const ESC_POS = {
    // Initialize printer
    INIT: Buffer.from([0x1B, 0x40]),
    
    // Print and feed n lines
    FEED: (lines = 3) => Buffer.from([0x1B, 0x64, lines]),
    
    // Cut paper (partial cut)
    PARTIAL_CUT: Buffer.from([0x1D, 0x56, 66, 0]),
    
    // Full cut
    FULL_CUT: Buffer.from([0x1D, 0x56, 66, 1]),
    
    // Set alignment (0=left, 1=center, 2=right)
    ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0]),
    ALIGN_CENTER: Buffer.from([0x1B, 0x61, 1]),
    ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 2]),
    
    // Text styles
    BOLD_ON: Buffer.from([0x1B, 0x45, 1]),
    BOLD_OFF: Buffer.from([0x1B, 0x45, 0]),
    
    // Double height/width
    DOUBLE_HEIGHT_WIDTH: Buffer.from([0x1D, 0x21, 0x33]),
    NORMAL_SIZE: Buffer.from([0x1D, 0x21, 0x00]),
    
    // Underline
    UNDERLINE_ON: Buffer.from([0x1B, 0x2D, 1]),
    UNDERLINE_OFF: Buffer.from([0x1B, 0x2D, 0]),
    
    // Line spacing
    LINE_SPACING_DEFAULT: Buffer.from([0x1B, 0x32]),
    
    // Barcode commands
    BARCODE_HEIGHT: Buffer.from([0x1D, 0x68, 100]),
    BARCODE_WIDTH: Buffer.from([0x1D, 0x77, 2]),
    BARCODE_PRINT: Buffer.from([0x1D, 0x6B, 73, 0, 0])
};

// Check if Web Bluetooth API is available
function isBluetoothAvailable() {
    return 'bluetooth' in navigator;
}

// Connect to Bluetooth printer
async function connectBluetoothPrinter() {
    if (!isBluetoothAvailable()) {
        toast("Bluetooth not supported in this browser", "error");
        return false;
    }

    try {
        // Request Bluetooth device
        // Common service UUIDs for receipt printers:
        // 000018f0-0000-1000-8000-00805f9b34fb - Generic printer
        // 49535343-FE7D-4AE5-8FA9-9FAFD205E455 - Some thermal printers
        printerDevice = await navigator.bluetooth.requestDevice({
            optionalServices: [
                '000018f0-0000-1000-8000-00805f9b34fb',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                '00004953-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/x/g, '0')
            ],
            acceptAllDevices: true
        });

        toast("Connecting to printer...", "info");

        // Connect to device
        const server = await printerDevice.gatt.connect();

        // Get the service - try common printer services
        let service;
        try {
            service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        } catch (e) {
            try {
                service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
            } catch (e2) {
                // Try to get any service that might be a printer
                const services = await server.getPrimaryServices();
                if (services.length > 0) {
                    service = services[0];
                    console.log("Using first available service:", service.uuid);
                } else {
                    throw new Error("No suitable Bluetooth service found");
                }
            }
        }

        // Get the characteristic for writing
        const characteristics = await service.getCharacteristics();
        
        // Find a writable characteristic
        for (const characteristic of characteristics) {
            if (characteristic.properties.write) {
                printerCharacteristic = characteristic;
                break;
            } else if (characteristic.properties.writeValue) {
                printerCharacteristic = characteristic;
                break;
            }
        }

        if (!printerCharacteristic) {
            throw new Error("No writable characteristic found");
        }

        isConnected = true;
        toast("Printer connected successfully!", "success");

        // Listen for disconnection
        printerDevice.addEventListener('gattserverdisconnected', onPrinterDisconnected);

        return true;

    } catch (error) {
        console.error("Bluetooth connection error:", error);
        toast("Failed to connect to printer: " + error.message, "error");
        disconnectPrinter();
        return false;
    }
}

// Handle printer disconnection
function onPrinterDisconnected() {
    console.log("Printer disconnected");
    isConnected = false;
    printerDevice = null;
    printerCharacteristic = null;
    toast("Printer disconnected", "info");
}

// Disconnect from printer
function disconnectPrinter() {
    if (printerDevice && printerDevice.gatt.connected) {
        printerDevice.gatt.disconnect();
    }
    isConnected = false;
    printerDevice = null;
    printerCharacteristic = null;
}

// Send data to printer
async function sendToPrinter(data) {
    if (!isConnected || !printerCharacteristic) {
        toast("Printer not connected", "error");
        return false;
    }

    try {
        if (typeof data === 'string') {
            data = Buffer.from(data, 'utf8');
        }
        
        await printerCharacteristic.writeValue(data);
        return true;
    } catch (error) {
        console.error("Print error:", error);
        toast("Failed to send to printer: " + error.message, "error");
        isConnected = false;
        return false;
    }
}

// Send text to printer
async function printText(text, options = {}) {
    const { align = 'left', bold = false, doubleSize = false } = options;
    
    let commands = [];
    
    // Set alignment
    if (align === 'center') {
        commands.push(ESC_POS.ALIGN_CENTER);
    } else if (align === 'right') {
        commands.push(ESC_POS.ALIGN_RIGHT);
    } else {
        commands.push(ESC_POS.ALIGN_LEFT);
    }
    
    // Set text style
    if (doubleSize) {
        commands.push(ESC_POS.DOUBLE_HEIGHT_WIDTH);
    } else if (bold) {
        commands.push(ESC_POS.BOLD_ON);
    } else {
        commands.push(ESC_POS.NORMAL_SIZE);
    }
    
    // Add text
    commands.push(Buffer.from(text, 'utf8'));
    
    // Reset style
    if (bold) {
        commands.push(ESC_POS.BOLD_OFF);
    } else if (doubleSize) {
        commands.push(ESC_POS.NORMAL_SIZE);
    }
    
    // New line
    commands.push(Buffer.from('\n', 'utf8'));
    
    // Concatenate all commands
    const combinedBuffer = Buffer.concat(commands);
    return sendToPrinter(combinedBuffer);
}

// Print separator line
async function printSeparator(char = '-', length = 32) {
    const line = char.repeat(length);
    return printText(line);
}

// Print receipt
async function printBluetoothReceipt(receiptNo, sales, DB) {
    if (!isConnected || !printerCharacteristic) {
        toast("Please connect to a printer first", "error");
        return false;
    }

    try {
        const firstSale = sales[0];
        const totalAmount = sales.reduce((sum, s) => sum + s.total, 0);
        const totalItems = sales.reduce((sum, s) => sum + s.quantity, 0);
        const storeName = firstSale.store_id === STORE1_ID ? "Store 1" : "Store 2";
        const cashierName = firstSale.user_name || "System";
        const customerName = firstSale.customer_name || "Walk-in Customer";
        const paymentMethod = firstSale.payment_method || "Cash";

        // Initialize printer
        await sendToPrinter(ESC_POS.INIT);
        await sendToPrinter(ESC_POS.LINE_SPACING_DEFAULT);

        // Header
        await sendToPrinter(ESC_POS.ALIGN_CENTER);
        await sendToPrinter(ESC_POS.DOUBLE_HEIGHT_WIDTH);
        await sendToPrinter(Buffer.from('TECHSQUARE\n', 'utf8'));
        await sendToPrinter(ESC_POS.NORMAL_SIZE);
        await sendToPrinter(Buffer.from('Multi-Store POS System\n', 'utf8'));
        await sendToPrinter(ESC_POS.BOLD_ON);
        await sendToPrinter(Buffer.from(`${storeName}\n`, 'utf8'));
        await sendToPrinter(ESC_POS.BOLD_OFF);
        await sendToPrinter(ESC_POS.ALIGN_LEFT);

        await printSeparator();

        // Receipt info
        await printText(`Receipt #: ${receiptNo}`);
        await printText(`Date: ${formatDate(firstSale.created_at)}`);
        await printText(`Time: ${firstSale.created_at ? new Date(firstSale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}`);
        await printText(`Cashier: ${cashierName}`);
        await printText(`Customer: ${customerName}`);
        await printText(`Payment: ${paymentMethod}`);

        await printSeparator();

        // Items
        await sendToPrinter(ESC_POS.BOLD_ON);
        await printText('ITEMS');
        await sendToPrinter(ESC_POS.BOLD_OFF);

        for (const sale of sales) {
            const itemTotal = sale.total;
            const unitPrice = sale.unit_price || 0;
            const variantLabel = sale.variant_label || "";
            
            // Product name and quantity
            await printText(`${sale.quantity}x ${sale.product_name}`);
            
            // Variant if exists
            if (variantLabel) {
                await printText(`  ${variantLabel}`);
            }
            
            // Unit price and total
            await sendToPrinter(ESC_POS.ALIGN_RIGHT);
            await printText(`@ ${money(unitPrice)}  ${money(itemTotal)}`);
            await sendToPrinter(ESC_POS.ALIGN_LEFT);
        }

        await printSeparator();

        // Summary
        await sendToPrinter(ESC_POS.ALIGN_RIGHT);
        await sendToPrinter(ESC_POS.BOLD_ON);
        await printText(`Total Items: ${totalItems}`);
        await printText(`TOTAL: ${money(totalAmount)}`);
        await sendToPrinter(ESC_POS.BOLD_OFF);
        await sendToPrinter(ESC_POS.ALIGN_LEFT);

        await printSeparator();

        // Footer
        await sendToPrinter(ESC_POS.ALIGN_CENTER);
        await printText('Thank you for shopping with');
        await sendToPrinter(ESC_POS.BOLD_ON);
        await printText('TECHSQUARE!');
        await sendToPrinter(ESC_POS.BOLD_OFF);
        await printText('Contact: +1 (555) 123-4567');
        await printText('www.techsquare.com');

        await printSeparator();

        await printText('Terms & Conditions Apply');
        await printText('Return Policy: 7 days with receipt');

        // Feed and cut
        await sendToPrinter(ESC_POS.FEED(5));
        await sendToPrinter(ESC_POS.PARTIAL_CUT);

        toast("Receipt printed successfully!", "success");
        return true;

    } catch (error) {
        console.error("Print receipt error:", error);
        toast("Failed to print receipt: " + error.message, "error");
        return false;
    }
}

// Print test page
async function printTestPage() {
    if (!isConnected || !printerCharacteristic) {
        toast("Please connect to a printer first", "error");
        return false;
    }

    try {
        await sendToPrinter(ESC_POS.INIT);
        await sendToPrinter(ESC_POS.LINE_SPACING_DEFAULT);

        await sendToPrinter(ESC_POS.ALIGN_CENTER);
        await sendToPrinter(ESC_POS.DOUBLE_HEIGHT_WIDTH);
        await sendToPrinter(Buffer.from('TEST PAGE\n', 'utf8'));
        await sendToPrinter(ESC_POS.NORMAL_SIZE);

        await printSeparator();

        await sendToPrinter(ESC_POS.ALIGN_LEFT);
        await printText('TECHSQUARE POS System');
        await printText('Bluetooth Printer Test');
        await printText(`Date: ${new Date().toLocaleString()}`);

        await printSeparator();

        await sendToPrinter(ESC_POS.ALIGN_CENTER);
        await printText('If you can read this,');
        await printText('your printer is working!');

        await sendToPrinter(ESC_POS.FEED(5));
        await sendToPrinter(ESC_POS.PARTIAL_CUT);

        toast("Test page printed successfully!", "success");
        return true;

    } catch (error) {
        console.error("Print test error:", error);
        toast("Failed to print test: " + error.message, "error");
        return false;
    }
}

// Check connection status
function getConnectionStatus() {
    return isConnected;
}

// Export service functions
const printerService = {
    isBluetoothAvailable,
    connectBluetoothPrinter,
    disconnectPrinter,
    printText,
    printSeparator,
    printBluetoothReceipt,
    printTestPage,
    getConnectionStatus
};

// Make functions available globally
if (typeof window !== 'undefined') {
    window.printerService = printerService;
}

export default printerService;