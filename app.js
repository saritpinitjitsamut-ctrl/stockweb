// ==========================================
// CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://xmsutulxswlqjtysarat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtc3V0dWx4c3dscWp0eXNhcmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODY1OTUsImV4cCI6MjA5NTg2MjU5NX0.TT0VqSxioTUwcrBFvlPiET9gxJIx_x3VPg8p-Qd7rAk';
const SUPABASE_TABLE_NAME = 'stock_orders';

// ==========================================
// DEBUG LOGGER
// ==========================================
function log(msg, type = 'info') {
    const consoleDiv = document.getElementById('debugConsole');
    if (consoleDiv) {
        consoleDiv.style.display = 'block';
        const line = document.createElement('div');
        line.className = 'debug-line';
        line.style.color = type === 'error' ? '#f87171' : (type === 'success' ? '#4ade80' : '#94a3b8');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        consoleDiv.prepend(line);
    }
    console.log(`[${type}] ${msg}`);
}

window.onerror = function(message, source, lineno, colno, error) {
    log(`Runtime Error: ${message} at ${lineno}:${colno}`, 'error');
    return false;
};

// Initialize Supabase Client
// Rename variable to dbSupabase to avoid conflict with 'supabase' global from library
let dbSupabase = null; 

try {
    log("กำลังเตรียมการเชื่อมต่อ Supabase...");
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' && window.supabase) {
        dbSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        log("เชื่อมต่อ Supabase สำเร็จ (Client Ready)", "success");
    } else {
        if (!window.supabase) log("ไม่พบ Supabase Library ในระบบ (อาจถูกบล็อกโดย Network)", "error");
        else log("ยังไม่ได้ระบุ Supabase URL หรือ Key", "error");
    }
} catch (e) {
    log(`Supabase Init Failed: ${e.message}`, "error");
}

document.addEventListener('DOMContentLoaded', () => {
    log("หน้าเว็บ (UI) โหลดเสร็จสมบูรณ์");
    
    // Set default date to today
    const orderDateInput = document.getElementById('orderDate');
    if (orderDateInput) orderDateInput.valueAsDate = new Date();

    const form = document.getElementById('stockForm');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!submitBtn) {
        log("ไม่พบปุ่มบันทึก (submitBtn) ในหน้าเว็บ", "error");
        return;
    }

    // ==========================================
    // AUTOFILL PRODUCT DATA BY SKU
    // ==========================================
    const productCodeInput = document.getElementById('productCode');
    const productFetchStatus = document.getElementById('productFetchStatus');
    const btnFetchSku = document.getElementById('btnFetchSku');
    
    async function fetchSkuData() {
        if (!productCodeInput || !dbSupabase) return;
        const code = productCodeInput.value.trim();
        if (!code) {
            if (productFetchStatus) productFetchStatus.textContent = '';
            return;
        }
        
        if (productFetchStatus) {
            productFetchStatus.textContent = '⏳ กำลังค้นหาข้อมูล...';
            productFetchStatus.style.color = '#fbbf24';
        }
        
        try {
            const { data, error } = await dbSupabase
                .from('sku_master')
                .select('*')
                .ilike('product_code', code)
                .maybeSingle(); 
                
            if (error) throw error;
            
            if (data) {
                if (productFetchStatus) {
                    productFetchStatus.textContent = '✅ พบข้อมูลสินค้า';
                    productFetchStatus.style.color = '#34d399';
                }
                
                if (data.name) document.getElementById('productName').value = data.name;
                if (data.size) document.getElementById('productSize').value = data.size;
                if (data.slots != null) document.getElementById('slots').value = data.slots;
                // If price exists in DB, use it
                if (data.price != null) document.getElementById('price').value = data.price;
            } else {
                if (productFetchStatus) {
                    productFetchStatus.textContent = '⚠️ ไม่พบรหัสนี้ในฐานข้อมูล (SKU Master)';
                    productFetchStatus.style.color = '#f87171'; // Red to make it obvious
                }
            }
        } catch (err) {
            console.error("Autofill Error: ", err);
            if (productFetchStatus) {
                productFetchStatus.textContent = '❌ ค้นหาล้มเหลว (อาจเป็นที่สิทธิ์ของฐานข้อมูล)';
                productFetchStatus.style.color = '#f87171';
            }
        }
    }

    if (productCodeInput) {
        productCodeInput.addEventListener('blur', fetchSkuData);
        productCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); fetchSkuData(); }
        });
    }
    if (btnFetchSku) {
        btnFetchSku.addEventListener('click', fetchSkuData);
    }

    log("กำลังติดตั้งระบบปุ่มบันทึก...");
    submitBtn.addEventListener('click', async (e) => {
        log("มีการคลิกปุ่มบันทึก (Manual Save Clicked)");
        e.preventDefault();

        if (!form || !form.checkValidity()) {
            log("ตรวจสอบล้มเหลว: ข้อมูลในฟอร์มไม่ครบถ้วน", "error");
            alert('❌ กรุณากรอกข้อมูลในช่องที่มีเครื่องหมายจำเป็นให้ครบถ้วนก่อนกดบันทึกครับ');
            if (form) form.reportValidity();
            return;
        }

        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        const statusMessage = document.getElementById('statusMessage');

        // UI Loading state
        submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline';
        if (statusMessage) {
            statusMessage.className = 'status-message';
            statusMessage.style.display = 'none';
        }

        log("กำลังอ่านข้อมูลจากฟอร์ม...");
        try {
            const orderNumber = document.getElementById('orderNumber').value.trim();
            const trackingNumber = document.getElementById('trackingNumber') ? document.getElementById('trackingNumber').value.trim() : null;

            if (!dbSupabase) throw new Error("Supabase Client ไม่พร้อมทำงาน");

            // --- ตรวจสอบข้อมูลซ้ำก่อนบันทึก (Manual) ---
            log("กำลังตรวจสอบข้อมูลซ้ำในฐานข้อมูล...");
            let query = dbSupabase.from(SUPABASE_TABLE_NAME).select('id').eq('order_number', orderNumber);
            if (trackingNumber) {
                query = dbSupabase.from(SUPABASE_TABLE_NAME).select('id')
                    .or(`order_number.eq.${orderNumber},tracking_number.eq.${trackingNumber}`);
            }

            const { data: existing, error: checkError } = await query;
            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                log("พบข้อมูลซ้ำ! ยกเลิกการบันทึก", "error");
                alert("❌ ข้อมูลคำสั่งซื้อหรือเลขพัสดุนี้มีอยู่แล้วในระบบ กรุณาตรวจสอบอีกครั้งครับ");
                return;
            }

            // -- เริ่มระบบอัปโหลดรูปภาพ (ถ้ามี) --
            const bookImageInput = document.getElementById('bookImage');
            let uploadedImageUrl = null;
            
            if (bookImageInput && bookImageInput.files.length > 0) {
                const file = bookImageInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                log(`กำลังอัปโหลดรูปภาพใบbook: ${fileName}`);
                if (statusMessage) {
                    statusMessage.textContent = 'กำลังอัปโหลดรูปภาพใบbook... ⏳';
                    statusMessage.style.display = 'block';
                    statusMessage.className = 'status-message';
                }

                const { data: uploadData, error: uploadError } = await dbSupabase
                    .storage
                    .from('book_images')
                    .upload(fileName, file);

                if (uploadError) {
                    log(`อัปโหลดรูปภาพล้มเหลว: ${uploadError.message}`, "error");
                    throw new Error(`อัปโหลดรูปล้มเหลว: ${uploadError.message}`);
                }

                const { data: publicUrlData } = dbSupabase
                    .storage
                    .from('book_images')
                    .getPublicUrl(fileName);

                uploadedImageUrl = publicUrlData.publicUrl;
                log(`อัปโหลดรูปภาพสำเร็จ: ${uploadedImageUrl}`, "success");
            }

            const formData = {
                order_date: document.getElementById('orderDate').value,
                platform: document.getElementById('platform').value,
                order_number: orderNumber,
                product_code: document.getElementById('productCode').value || null,
                product_name: document.getElementById('productName').value,
                product_size: document.getElementById('productSize').value || null,
                slots: document.getElementById('slots').value ? parseInt(document.getElementById('slots').value) : null,
                quantity: parseInt(document.getElementById('quantity').value),
                price: parseFloat(document.getElementById('price').value),
                shipping_fee: parseFloat(document.getElementById('shippingFee').value || 0),
                buyer_name: document.getElementById('buyerName').value,
                address: document.getElementById('address').value || null,
                province: document.getElementById('province').value,
                status: document.getElementById('status').value,
                tracking_status: document.getElementById('status').value,
                book_image_url: uploadedImageUrl,
                note: document.getElementById('note') ? document.getElementById('note').value || null : null,
                tracking_number: trackingNumber,
                courier_phone: null
            };
            log(`รวบรวมข้อมูลสำเร็จ: ${formData.order_number}`);
            
            log("กำลังส่งข้อมูลไปที่ Supabase Database...");
            const { data, error } = await dbSupabase
                .from(SUPABASE_TABLE_NAME)
                .insert([formData]);

            if (error) throw error;

            log("บันทึกลง Supabase สำเร็จ!", "success");
            if (statusMessage) {
                statusMessage.textContent = '✅ บันทึกข้อมูลสำเร็จ!';
                statusMessage.style.display = 'block';
                statusMessage.className = 'status-message status-success';
            }
            
            form.reset();
            if (orderDateInput) orderDateInput.valueAsDate = new Date();
            document.getElementById('platform').value = "";
            document.getElementById('status').value = "รอดำเนินการ";
            if (bookImageInput) bookImageInput.value = "";
            const pcInput = document.getElementById('productCode');
            if (pcInput) pcInput.value = "";
            const noteInput = document.getElementById('note');
            if (noteInput) noteInput.value = "";
            const trackingInput = document.getElementById('trackingNumber');
            if (trackingInput) trackingInput.value = "";

        } catch (error) {
            log(`บันทึกไม่สำเร็จ: ${error.message}`, "error");
            if (statusMessage) {
                statusMessage.style.display = 'block';
                statusMessage.textContent = `❌ เกิดข้อผิดพลาด: ${error.message}`;
                statusMessage.className = 'status-message status-error';
            }
            alert(`ข้อผิดพลาดการบันทึก: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    });

    // ==========================================
    // EXCEL / CSV BULK UPLOAD SYSTEM
    // ==========================================
    const manualTabBtn = document.getElementById('manualTabBtn');
    const uploadTabBtn = document.getElementById('uploadTabBtn');

    if (manualTabBtn && uploadTabBtn) {
        log("กำลังติดตั้งระบบสลับแท็บ...");
        manualTabBtn.addEventListener('click', () => {
            manualTabBtn.classList.add('active');
            uploadTabBtn.classList.remove('active');
            document.getElementById('manualSection').style.display = 'block';
            document.getElementById('uploadSection').style.display = 'none';
        });
        uploadTabBtn.addEventListener('click', () => {
            uploadTabBtn.classList.add('active');
            manualTabBtn.classList.remove('active');
            document.getElementById('manualSection').style.display = 'none';
            document.getElementById('uploadSection').style.display = 'block';
        });
    }

    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    let parsedDataToUpload = [];

    if (dropZone) {
        log("กำลังติดตั้งระบบลากวางไฟล์...");
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFileSelect(e.target.files[0]);
        });
    }

    function handleFileSelect(file) {
        log(`เลือกไฟล์: ${file.name}`);
        document.getElementById('fileNameDisplay').innerHTML = `✅ เลือกไฟล์แล้ว:<br><span style="font-size: 0.9rem; color: #cbd5e1;">${file.name}</span>`;
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                log("กำลังอ่านไฟล์ Excel...");
                const data = new Uint8Array(e.target.result);
                log(`อ่าน Buffer สำเร็จ (${data.length} bytes)`);
                const workbook = XLSX.read(data, {type: 'array'});
                log("ถอดรหัส Workbook สำเร็จ");
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
                log(`ประมวลผลเป็น JSON สำเร็จ (${rawData.length} แถว)`);
                if (rawData.length === 0) {
                    log("ไม่พบข้อมูลในไฟล์", "error");
                    alert('ไม่พบข้อมูลในไฟล์ หรือไฟล์ผิดรูปแบบ');
                    return;
                }
                log(`เริ่มวิเคราะห์ข้อมูล...`);
                await processExcelData(rawData);
            } catch (err) {
                log(`ล้มเหลว: ${err.message}`, "error");
                alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function extractSkuFromName(name) {
        if (!name) return null;
        // มองหารูปแบบ SKU เช่น BKH-BK-50-40-GK ที่ซ่อนอยู่ในชื่อสินค้า 
        // โดยใช้รูปแบบ (ภาษาอังกฤษ/ตัวเลข) ติดกับ (-)
        const match = String(name).match(/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)/);
        return match ? match[1] : null;
    }

    function extractSizeAndSlots(itemName) {
        if (!itemName) return { size: null, slots: null };
        let size = null, slots = null;
        const sizeMatch = String(itemName).match(/size\s*([a-zA-Z0-9]+)|ขนาด\s*([a-zA-Z0-9]+)|\b([SML]|XL|XXL|XXXL)\b/i);
        if (sizeMatch) size = sizeMatch[1] || sizeMatch[2] || sizeMatch[3];
        const slotMatch = String(itemName).match(/(\d+)\s*ช่อง/);
        if (slotMatch) slots = parseInt(slotMatch[1]);
        return { size: size ? size.toUpperCase() : null, slots };
    }

    function getValue(row, keys) {
        const rowKeys = Object.keys(row);
        for (let k of keys) {
            // Check exact match first
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]).trim();
            
            // If not found, check case-insensitive and space-insensitive
            const normalizedK = k.toLowerCase().trim();
            const foundKey = rowKeys.find(rk => rk.toLowerCase().trim() === normalizedK);
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
                return String(row[foundKey]).trim();
            }
        }
        return null;
    }

    async function processExcelData(rawData) {
        log("กำลังรวบรวมข้อมูล...");
        const headers = Object.keys(rawData[0]);
        log("Headers found in file: " + headers.join(', '));
        log("Sample row (0) keys: " + Object.keys(rawData[0]).join(', '));
        console.log("Full sample row data:", rawData[0]);
        
        const isLazada = headers.some(h => h.includes('lazada') || h.includes('createTime'));
        const isShopee = headers.some(h => h.includes('วันที่ทำการสั่งซื้อ'));
        const isTikTok = headers.some(h => h.includes('Created Time'));
        let platform = isLazada ? 'Lazada' : (isShopee ? 'Shopee' : (isTikTok ? 'TikTok' : 'Other'));
        log(`ตรวจพบแพลตฟอร์ม: ${platform}`);
        
        // 1. รวบรวม SKU และ ชื่อสินค้า เพื่อจะไปดึงทีเดียว
        const skusToFetch = [];
        const namesToFetch = [];
        rawData.forEach(row => {
            let pCode = null, pName = "";
            if (platform === 'Lazada') { pCode = getValue(row, ['sellerSku']); pName = getValue(row, ['itemName']); }
            if (platform === 'Shopee') { pCode = getValue(row, ['เลขอ้างอิง Parent SKU', 'เลขอ้างอิง SKU (SKU Reference No.)', 'Parent SKU', 'SKU']); pName = getValue(row, ['ชื่อสินค้า']); }
            if (platform === 'TikTok') { pCode = getValue(row, ['Seller SKU', 'SKU ID']); pName = getValue(row, ['Product Name']); }
            
            pCode = pCode || extractSkuFromName(pName);
            if (pCode) skusToFetch.push(pCode);
            if (pName) namesToFetch.push(pName);
        });

        let masterDict = {};
        if (typeof dbSupabase !== 'undefined' && dbSupabase) {
            log("กำลังเชื่อมต่อ SKU Master เพื่อตรวจสอบราคาและขนาด...");
            try {
                // Optimized Fetch Function: Chunking to avoid URL length limits
                async function fetchInChunks(column, values) {
                    const uniqueValues = [...new Set(values)].filter(v => v);
                    const total = uniqueValues.length;
                    if (total === 0) return [];
                    
                    const chunkSize = 10; // Even smaller batch to be extremely safe
                    log(`กำลังดึงข้อมูล ${column}: ทั้งหมด ${total} รายการ (แบ่ง ${Math.ceil(total/chunkSize)} ชุด)...`);
                    let results = [];
                    
                    for (let i = 0; i < total; i += chunkSize) {
                        const chunk = uniqueValues.slice(i, i + chunkSize);
                        const progress = `[${Math.min(i + chunkSize, total)}/${total}]`;
                        log(`⏳ กำลังโหลด ${column} ${progress}...`);
                        
                        const { data, error } = await dbSupabase.from('sku_master').select('*').in(column, chunk);
                        
                        if (error) {
                            log(`❌ Error ${progress}: ${error.message}`, "error");
                            continue;
                        }
                        if (data) results = results.concat(data);
                    }
                    return results;
                }

                // Fetch by SKU Code
                if (skusToFetch.length > 0) {
                    const skusData = await fetchInChunks('product_code', skusToFetch);
                    skusData.forEach(item => {
                        if (item.product_code) masterDict['CODE_' + item.product_code.toLowerCase()] = item;
                    });
                }

                // Fetch by Product Name
                if (namesToFetch.length > 0) {
                    const namesData = await fetchInChunks('name', namesToFetch);
                    namesData.forEach(item => {
                        if (item.name) masterDict['NAME_' + item.name.toLowerCase()] = item;
                    });
                }
                
                log("ตรวจสอบข้อมูล SKU Master เสร็จสมบูรณ์", "success");
            } catch (err) {
                log(`Master Fetch Error: ${err.message}`, "error");
                console.error("Master Fetch Error:", err);
            }
        }

        parsedDataToUpload = [];
        rawData.forEach((row, index) => {
            if (Object.values(row).every(v => v === "")) return;
            let date = new Date().toISOString().split('T')[0];
            let orderNumber = `UNK-${index}`, trackingNumber = null, courierPhone = null, productCode = null, productName = "Unknown", quantity = 1, price = 0, shipping = 0, buyer = "Unknown", address = null, province = "Unknown", status = "รอดำเนินการ", note = null;
            if (platform === 'Lazada') {
                const dateRaw = getValue(row, ['createTime']);
                if (dateRaw) { try { date = new Date(dateRaw).toISOString().split('T')[0]; } catch(e){} }
                orderNumber = getValue(row, ['orderiemId', 'orderItemId']) || orderNumber;
                trackingNumber = getValue(row, ['trackingCode', 'trackingNumber', 'tracking_number']);
                productCode = getValue(row, ['sellerSku']) || productCode;
                productName = getValue(row, ['itemName']) || productName;
                price = parseFloat(getValue(row, ['unitPrice']) || 0);
                shipping = parseFloat(getValue(row, ['shippingFee']) || 0);
                buyer = getValue(row, ['billingName']) || buyer;
                address = getValue(row, ['billingAddr1', 'billingAddress']);
                province = getValue(row, ['billingAddr4']) || province;
                note = getValue(row, ['buyerMessage', 'หมายเหตุ']) || note;
            } else if (platform === 'Shopee') {
                const dateRaw = getValue(row, ['วันที่ทำการสั่งซื้อ']);
                if (dateRaw) date = dateRaw.split(' ')[0];
                orderNumber = getValue(row, ['หมายเลขคำสั่งซื้อ']) || orderNumber;
                productCode = getValue(row, ['เลขอ้างอิง Parent SKU', 'เลขอ้างอิง SKU (SKU Reference No.)', 'Parent SKU', 'SKU']) || productCode;
                productName = getValue(row, ['ชื่อสินค้า']) || productName;
                quantity = parseInt(getValue(row, ['จำนวน']) || 1);
                price = parseFloat(getValue(row, ['ราคาตั้งต้น']) || 0);
                shipping = parseFloat(getValue(row, ['ค่าจัดส่งที่ชำระโดยผู้ซื้อ', 'ค่าจัดส่ง']) || 0);
                buyer = getValue(row, ['ชื่อผู้ใช้ (ผู้ซื้อ)']) || buyer;
                courierPhone = getValue(row, ['courier_phone']);
                address = getValue(row, ['ที่อยู่', 'ที่อยู่ในการจัดส่ง']);
                province = getValue(row, ['จังหวัด']) || province;
                note = getValue(row, ['ข้อความจากผู้ซื้อ', 'หมายเหตุ']) || note;
                trackingNumber = getValue(row, [
                    '*หมายเลขติดตามพัสดุ',
                    'หมายเลขติดตามพัสดุ', 
                    'เลขพัสดุ', 
                    'Tracking Number', 
                    'Tracking ID', 
                    'Tracking Number*', 
                    'Tracking No.',
                    'หมายเลขพัสดุ',
                    'tracking_number'
                ]);
            } else if (platform === 'TikTok') {
                const dateRaw = getValue(row, ['Created Time']);
                if (dateRaw) { try { date = new Date(dateRaw.split(' ')[0].replace(/\//g,'-')).toISOString().split('T')[0]; } catch(e){} }
                orderNumber = getValue(row, ['Order ID']) || orderNumber;
                productCode = getValue(row, ['Seller SKU', 'SKU ID']) || productCode;
                productName = getValue(row, ['Product Name']) || productName;
                quantity = parseInt(getValue(row, ['Quantity']) || 1);
                price = parseFloat(getValue(row, ['1 SKU original price']) || 0);
                shipping = parseFloat(getValue(row, ['Shipping Fee', 'shipping fee']) || 0);
                buyer = getValue(row, ['Buyer Username', 'Recipient Name']) || buyer;
                address = getValue(row, ['Full Address', 'Detailed Address']);
                province = getValue(row, ['Province']) || province;
                note = getValue(row, ['Buyer Message', 'หมายเหตุ']) || note;
                trackingNumber = getValue(row, ['Tracking Number', 'Tracking ID', 'tracking_number']);
            }
            
            // พยายามดึง SKU จากชื่อสินค้าในกรณีที่ได้มาไม่ครบ
            productCode = productCode || extractSkuFromName(productName);

            let { size, slots } = extractSizeAndSlots(productName);
            
            // 2. ถ้าเจอใน masterDict เอาข้อมูลมาทับของเดิม (Overide Excel)
            const master = (productCode && masterDict['CODE_' + productCode.toLowerCase()]) || 
                           (productName && masterDict['NAME_' + productName.toLowerCase()]);
                           
            if (master) {
                if (!productCode) productCode = master.product_code; // If we found by name, fill SKU
                if (master.name) productName = master.name;
                if (master.size) size = master.size;
                if (master.slots != null) slots = parseInt(master.slots);
                if (master.price != null) price = parseFloat(master.price);
            }

            parsedDataToUpload.push({
                order_date: date, platform: platform, order_number: orderNumber, product_code: productCode, product_name: productName,
                product_size: size, slots: slots, quantity: quantity, price: price, shipping_fee: shipping,
                buyer_name: buyer, address: address, province: province, 
                status: status, // Add this back
                tracking_status: status, 
                note: note,
                tracking_number: trackingNumber, courier_phone: courierPhone
            });
        });
        renderPreview();
    }

    function renderPreview() {
        const tbody = document.getElementById('previewBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        document.getElementById('previewCount').textContent = parsedDataToUpload.length;
        document.getElementById('previewSection').style.display = 'block';
        parsedDataToUpload.slice(0, 10).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.platform}</td>
                <td>${item.order_date}</td>
                <td>${item.order_number}</td>
                <td>${item.tracking_number || '-'}</td>
                <td title="${item.product_code || ''}">${item.product_code || '-'}</td>
                <td title="${item.product_name}">${String(item.product_name).substring(0, 25)}...</td>
                <td>${item.product_size || '-'}</td>
                <td>${item.slots || '-'}</td>
                <td>x${item.quantity} | ${item.price}฿</td>
                <td>${item.note || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const bulkUploadBtn = document.getElementById('bulkUploadBtn');
    if (bulkUploadBtn) {
        bulkUploadBtn.addEventListener('click', async () => {
            if (!parsedDataToUpload.length || !dbSupabase) return;
            log(`กำลังเตรียมตรวจสอบข้อมูลซ้ำและอัปโหลด ${parsedDataToUpload.length} รายการ...`);
            bulkUploadBtn.disabled = true;
            
            try {
                // 1. ตรวจสอบข้อมูลซ้ำในก้อนใหญ่ทีเดียว (Batch Check)
                const orderNumbers = parsedDataToUpload.map(o => o.order_number);
                const trackingNumbers = parsedDataToUpload.map(o => o.tracking_number).filter(t => t);
                
                log(`กำลังค้นหาข้อมูลที่มีอยู่แล้วในระบบ...`);
                // Check either order_number or tracking_number exists
                const { data: existing, error: checkError } = await dbSupabase
                    .from(SUPABASE_TABLE_NAME)
                    .select('order_number, tracking_number')
                    .or(`order_number.in.(${orderNumbers.join(',')}),tracking_number.in.(${trackingNumbers.join(',')})`);

                if (checkError) throw checkError;

                const existingOrderSet = new Set(existing.map(e => String(e.order_number)));
                const existingTrackingSet = new Set(existing.map(e => String(e.tracking_number)).filter(t => t !== 'null'));

                // 2. กรองข้อมูลเอาเฉพาะรายการที่ไม่ซ้ำ
                const filteredData = parsedDataToUpload.filter(item => {
                    const isOrderDup = existingOrderSet.has(String(item.order_number));
                    const isTrackingDup = item.tracking_number && existingTrackingSet.has(String(item.tracking_number));
                    return !isOrderDup && !isTrackingDup;
                });

                const skipCount = parsedDataToUpload.length - filteredData.length;
                const successCount = filteredData.length;

                if (successCount === 0) {
                    log("ข้อมูลซ้ำทั้งหมด! ไม่มีการบันทึก", "error");
                    alert(`⚠️ ข้อมูลในไฟล์นี้ซ้ำกับในระบบทั้งหมดจำนวน ${skipCount} รายการ! ไม่มีการบันทึกใหม่`);
                    bulkUploadBtn.disabled = false;
                    return;
                }

                log(`กรองรายการซ้ำออก ${skipCount} รายการ, กำลังบันทึกรายการใหม่ ${successCount} รายการ...`);

                const chunkSize = 50;
                for (let i = 0; i < filteredData.length; i += chunkSize) {
                    const chunk = filteredData.slice(i, i + chunkSize);
                    const { error } = await dbSupabase.from(SUPABASE_TABLE_NAME).insert(chunk);
                    if (error) throw error;
                    log(`อัปโหลดสำเร็จแล้ว ${Math.min(i + chunkSize, filteredData.length)} รายการ`);
                }

                log("บันทึกข้อมูลทั้งหมดสำเร็จ!", "success");
                alert(`✅ นำเข้าข้อมูลสำเร็จ!\n- บันทึกใหม่: ${successCount} รายการ\n- ข้ามรายการซ้า: ${skipCount} รายการ`);
                
                // Clear UI for next file
                parsedDataToUpload = [];
                if (fileInput) fileInput.value = ""; // Reset file input
                const tbody = document.getElementById('previewBody');
                if (tbody) tbody.innerHTML = ""; // Clear table
                
                document.getElementById('previewSection').style.display = 'none';
                document.getElementById('fileNameDisplay').textContent = "📂 ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์";
            } catch (error) {
                log(`ล้มเหลว: ${error.message}`, "error");
                alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
            } finally {
                bulkUploadBtn.disabled = false;
            }
        });
    }
});
