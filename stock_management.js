// ==========================================
// STOCK MANAGEMENT SYSTEM
// ==========================================

const STOCK_TABLE_NAME = 'stock_items';
let dbSupabase = null;
let allStocks = [];
let currentEditingId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Get Supabase client from auth.js or initialize from SUPABASE_CONFIG
    dbSupabase = (window.auth && window.auth.supabase) 
        ? window.auth.supabase 
        : (window.supabase && window.SUPABASE_CONFIG 
            ? window.supabase.createClient(window.SUPABASE_CONFIG.URL, window.SUPABASE_CONFIG.KEY) 
            : null);
    
    if (!dbSupabase) {
        // Show a more helpful message
        const authStatus = window.auth ? "Auth initialized but no client" : "Auth not loaded";
        const configStatus = window.SUPABASE_CONFIG ? "Config loaded" : "Config missing (config.js)";
        
        console.error('Database connection failed:', { authStatus, configStatus });
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล\n\n' + 
              'สาเหตุที่เป็นไปได้:\n' +
              '1. ยังไม่ได้สร้างไฟล์ config.js\n' +
              '2. เปิดไฟล์ผ่าน file:// (ควรใช้ Local Server)');
        return;
    }

    // Load stock data
    await refreshStockList();

    // Setup form submission
    document.getElementById('stockForm').addEventListener('submit', handleFormSubmit);
});

// ==========================================
// LOAD STOCK DATA
// ==========================================

async function refreshStockList() {
    try {
        const { data, error } = await dbSupabase
            .from(STOCK_TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allStocks = data || [];
        renderStockTable(allStocks);
        updateStatistics();
    } catch (error) {
        console.error('Error loading stocks:', error);
        alert('ไม่สามารถโหลดข้อมูลสินค้า');
    }
}

// ==========================================
// RENDER STOCK TABLE
// ==========================================

function renderStockTable(stocks) {
    const tbody = document.getElementById('stockTableBody');
    const emptyState = document.getElementById('emptyState');

    if (stocks.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = stocks.map(stock => {
        const isLowStock = stock.quantity <= (stock.reorder_point || 10);
        const statusBadge = isLowStock 
            ? `<span class="status-badge status-low">⚠️ ต่ำ (${stock.quantity})</span>`
            : `<span class="status-badge status-ok">✅ พอดี (${stock.quantity})</span>`;

        const size = (stock.width && stock.height) 
            ? `${stock.width} × ${stock.height}`
            : (stock.width || stock.height || '-');

        return `
            <tr>
                <td><strong>${stock.product_name}</strong></td>
                <td>${stock.product_code || '-'}</td>
                <td>${getCategoryLabel(stock.category)}</td>
                <td><strong>${stock.quantity}</strong></td>
                <td>${stock.unit || '-'}</td>
                <td>${size}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn action-btn-edit" onclick="openEditModal('${stock.id}')">✏️ แก้ไข</button>
                        <button class="action-btn action-btn-delete" onclick="deleteStock('${stock.id}')">🗑️ ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// SEARCH & FILTER
// ==========================================

function searchStocks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;

    const filtered = allStocks.filter(stock => {
        const matchesSearch = stock.product_name.toLowerCase().includes(searchTerm) ||
                            (stock.product_code && stock.product_code.toLowerCase().includes(searchTerm));
        const matchesCategory = !categoryFilter || stock.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    renderStockTable(filtered);
}

// ==========================================
// STATISTICS
// ==========================================

function updateStatistics() {
    const totalItems = allStocks.length;
    const lowStockItems = allStocks.filter(s => s.quantity <= (s.reorder_point || 10)).length;
    const totalQuantity = allStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);

    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('lowStockItems').textContent = lowStockItems;
    document.getElementById('totalValue').textContent = totalQuantity;
}

// ==========================================
// MODAL OPERATIONS
// ==========================================

function openAddModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').textContent = 'เพิ่มสินค้าใหม่';
    document.getElementById('stockForm').reset();
    document.getElementById('stockModal').classList.add('active');
}

async function openEditModal(id) {
    const stock = allStocks.find(s => s.id === id);
    if (!stock) return;

    currentEditingId = id;
    document.getElementById('modalTitle').textContent = 'แก้ไขข้อมูลสินค้า';

    document.getElementById('productName').value = stock.product_name;
    document.getElementById('productCode').value = stock.product_code || '';
    document.getElementById('category').value = stock.category;
    document.getElementById('quantity').value = stock.quantity;
    document.getElementById('unit').value = stock.unit || '';
    document.getElementById('width').value = stock.width || '';
    document.getElementById('height').value = stock.height || '';

    document.getElementById('stockModal').classList.add('active');
}

function closeModal() {
    document.getElementById('stockModal').classList.remove('active');
    currentEditingId = null;
    document.getElementById('stockForm').reset();
}

// ==========================================
// FORM SUBMISSION
// ==========================================

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        product_name: document.getElementById('productName').value,
        product_code: document.getElementById('productCode').value || null,
        category: document.getElementById('category').value,
        quantity: parseInt(document.getElementById('quantity').value),
        unit: document.getElementById('unit').value || null,
        width: document.getElementById('width').value 
            ? parseFloat(document.getElementById('width').value)
            : null,
        height: document.getElementById('height').value 
            ? parseFloat(document.getElementById('height').value)
            : null,
    };

    try {
        if (currentEditingId) {
            // UPDATE existing stock
            const { error } = await dbSupabase
                .from(STOCK_TABLE_NAME)
                .update({
                    ...formData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentEditingId);

            if (error) throw error;
            alert('✅ อัพเดทสินค้าสำเร็จ');
        } else {
            // INSERT new stock
            const { error } = await dbSupabase
                .from(STOCK_TABLE_NAME)
                .insert([formData]);

            if (error) throw error;
            alert('✅ เพิ่มสินค้าสำเร็จ');
        }

        closeModal();
        await refreshStockList();
    } catch (error) {
        console.error('Form submission error:', error);
        alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
}

// ==========================================
// DELETE STOCK
// ==========================================

async function deleteStock(id) {
    if (!confirm('คุณแน่ใจหรือว่าต้องการลบสินค้านี้?')) return;

    try {
        const { error } = await dbSupabase
            .from(STOCK_TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ ลบสินค้าสำเร็จ');
        await refreshStockList();
    } catch (error) {
        console.error('Delete error:', error);
        alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getCategoryLabel(category) {
    const labels = {
        'general': '🔹 ทั่วไป',
        'glass': '🔷 กระจก',
        'aluminum': '🔶 อลูมิเนียม',
        'tools': '🔨 เครื่องมือ'
    };
    return labels[category] || category;
}
