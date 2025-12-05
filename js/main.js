// MAIN.JS - Complete Application Logic
// Combines all Firebase operations, forms, tables, charts, calendar, and analytics

// ===== IMPORTS =====
import { db } from './firebase-config.js';
import { onAuthStateChanged, getCurrentUser, logoutUser, updateLastLogin } from './auth.js';
import { getUserPermissions, canUserAction, getUserAccessiblePages, isAdmin } from './permissions.js';
import { initAdminPanel } from './admin.js';
import { ref, set, get, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// ===== GLOBAL STATE =====
let currentUser = null;
let userPermissions = null;

// ===== CATALOG NAMES (shared across forms) =====
const CATALOG_NAMES = [                      
    "⼯作機械⽤油圧機器", "プラスチック加⼯機械⽤油圧機器", "A3HGシリーズ⾼圧可変ピストンポンプ",
    "A3HMシリーズ高圧可変ピストンポンプ", "The ASR series Ultimate hydraulic control system",
    "ASRシリーズACサーボモータ駆動ポンプ", "ロジック弁", "インライン形プレフィル弁",
    "センタDINコネクタ形電磁弁", "リニューアルアンプ搭載Gシリーズ可変ショックレス形電磁切換弁",
    "EHシリーズ⽐例電磁式制御機器", "比例電磁式レデューシングモジュラー弁　EMRP-01",
    "アンプ搭載形比例電磁式方向・流量制御弁", "比例電磁式方向・流量制御弁",
    "高速リニアサーボ弁シリーズ", "ダブルモータ直動形リニアサーボ弁",
    "ポジションセンシング油圧シリンダ", "CHW形油圧シリンダ", "ミニ油圧シリンダ",
    "HE-YAパック", "標準油圧ユニット", "省エネコントローラオートチューニング機能付き",
    "コンタミキット", "YB-32/50/65/80M ⾃動マルチコンパクタ"
];

// ===== INITIALIZE CATALOG SELECTS =====
function initializeCatalogSelects() {
    const selects = document.querySelectorAll('#CatalogName, #OrderCatalogName');
    selects.forEach(select => {
        select.innerHTML = '<option value="">--選択してください--</option>';
        CATALOG_NAMES.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    });
}

// ===== ROLE-BASED NAVIGATION =====
function initRoleBasedNavigation(userRole) {
    // Hide/show nav groups based on user role
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    const isUser = userRole === 'user';
    
    // Inventory group - only for admin/manager
    document.querySelectorAll('.nav-group-inventory').forEach(btn => {
        btn.style.display = (isAdmin || isManager) ? 'inline-block' : 'none';
    });
    
    // Management group - only for admin
    document.querySelectorAll('.nav-group-management').forEach(btn => {
        btn.style.display = isAdmin ? 'inline-block' : 'none';
    });
    
    // Ordering group - visible to all
    document.querySelectorAll('.nav-group-ordering').forEach(btn => {
        btn.style.display = 'inline-block';
    });
    
    // Dashboard - visible to all
    document.querySelectorAll('.nav-group-dashboard').forEach(btn => {
        btn.style.display = 'inline-block';
    });
    
    // Analytics - only for admin
    document.querySelectorAll('.nav-group-analytics').forEach(btn => {
        btn.style.display = isAdmin ? 'inline-block' : 'none';
    });
    
    // Hide dividers if all buttons in adjacent groups are hidden
    const dividers = document.querySelectorAll('.nav-group-divider');
    dividers.forEach((divider, index) => {
        // Show divider if both adjacent groups have visible buttons
        let prevVisible = false;
        let nextVisible = false;
        
        // Check buttons before this divider
        const beforeDivider = divider.previousElementSibling;
        if (beforeDivider && beforeDivider.style.display !== 'none') {
            prevVisible = true;
        }
        
        // Check buttons after this divider
        const afterDivider = divider.nextElementSibling;
        if (afterDivider && afterDivider.style.display !== 'none') {
            nextVisible = true;
        }
        
        divider.style.display = (prevVisible && nextVisible) ? 'inline-block' : 'none';
    });
}

// ===== TAB SWITCHING =====
function initTabSwitching() {
    document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-section').forEach(tab => tab.style.display = 'none');
            const tabName = this.getAttribute('data-tab');
            const tab = document.getElementById('tab-' + tabName);
            if (tab) tab.style.display = 'block';
            
            // Lazy-load expensive components
            if (tabName === 'stockCalendar' && !window.calendarInitialized) {
                initializeCalendar();
                window.calendarInitialized = true;
            }
            if (tabName === 'catalogEntries') renderCatalogTablesAccordion();
            if (tabName === 'orderEntries') renderOrderTablesAccordion();
            if (tabName === 'analytics') {
                document.getElementById('analyticsDateRangeCard').style.display = 'block';
                fetchAndRenderAnalytics();
            } else {
                const dateCard = document.getElementById('analyticsDateRangeCard');
                if (dateCard) dateCard.style.display = 'none';
            }
        });
    });
        document.getElementById('tab-manageCatalog').style.display = 'block';
        const topNavBtns = document.querySelectorAll('.nav-link-btn');
        topNavBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                
                // Hide all tabs
                document.querySelectorAll('.tab-section').forEach(t => t.style.display = 'none');
                
                // Show selected tab
                const tabElement = document.getElementById('tab-' + tab);
                if (tabElement) tabElement.style.display = 'block';
                
                // Update active states
                topNavBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.sidebar-nav-btn').forEach(b => {
                    if (b.getAttribute('data-tab') === tab) {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });
                
                // Lazy-load expensive components
                if (tab === 'stockCalendar' && !window.calendarInitialized) {
                    initializeCalendar();
                    window.calendarInitialized = true;
                }
                if (tab === 'catalogEntries') renderCatalogTablesAccordion();
                if (tab === 'orderEntries') renderOrderTablesAccordion();
                if (tab === 'analytics') {
                    document.getElementById('analyticsDateRangeCard').style.display = 'block';
                    fetchAndRenderAnalytics();
                } else {
                    const dateCard = document.getElementById('analyticsDateRangeCard');
                    if (dateCard) dateCard.style.display = 'none';
                }
            });
        });
    document.getElementById('analyticsDateRangeCard').style.display = 'none';
}

// ===== CATALOG FORM =====
function initCatalogForm() {
    document.getElementById('CatalogName').addEventListener('change', async function() {
        const catalogRef = ref(db, 'Catalogs/');
        const snapshot = await get(catalogRef);
        let lastStock = 0;
        if (snapshot.exists()) {
            const data = snapshot.val();
            const entries = Object.values(data).filter(e => e.CatalogName === this.value);
            if (entries.length > 0) {
                entries.sort((a, b) => new Date((a.ReceiptDate || '1970-01-01')) - new Date((b.ReceiptDate || '1970-01-01')));
                lastStock = Number(entries[entries.length - 1].StockQuantity) || 0;
            }
        }
        document.getElementById('StockQuantity').value = lastStock;
        document.getElementById('StockQuantity').readOnly = entries && entries.length > 0;
    });
    
    document.getElementById('Insbtn').addEventListener('click', async function() {
        const form = document.getElementById('catalogEntryForm');
        const data = {
            CatalogName: form.CatalogName.value,
            ReceiptDate: form.ReceiptDate.value,
            QuantityReceived: Number(form.QuantityReceived.value),
            DeliveryDate: form.DeliveryDate.value,
            IssueQuantity: Number(form.IssueQuantity.value),
            StockQuantity: Number(form.StockQuantity.value),
            DistributionDestination: form.DistributionDestination.value,
            Requester: form.Requester.value,
            Remarks: form.Remarks.value,
        };
        
        if (!data.CatalogName || !data.ReceiptDate || !data.DeliveryDate || !data.DistributionDestination || !data.Requester) {
            alert('必須項目を入力してください');
            return;
        }
        
        try {
            const newId = data.CatalogName + "_" + Date.now();
            await set(ref(db, "Catalogs/" + newId), data);
            await logAuditEvent('ADD_CATALOG', `Added: ${data.CatalogName} (Qty: ${data.StockQuantity})`, currentUser?.email);
            await logMovement(data.CatalogName, 0, data.StockQuantity, 'INITIAL_RECEIPT');
            alert("カタログエントリを登録しました");
            form.reset();
            renderCatalogTablesAccordion();
            updateKPIs();
        } catch (error) {
            alert("エラー: " + error);
        }
    });
}

// ===== ORDER FORM =====
function initOrderForm() {
    document.getElementById('OrderBtn').addEventListener('click', async function() {
        const form = document.getElementById('orderForm');
        const data = {
            CatalogName: form.OrderCatalogName.value,
            OrderQuantity: Number(form.OrderQuantity.value),
            Requester: form.OrderRequester.value,
            Message: document.getElementById('OrderMessage').innerHTML,
            OrderDate: new Date().toISOString().split('T')[0]
        };
        
        if (!data.CatalogName || !data.OrderQuantity || !data.Requester) {
            alert('必須項目を入力してください');
            return;
        }
        
        try {
            await set(ref(db, "Orders/" + data.CatalogName + "_" + Date.now()), data);
            await logAuditEvent('CREATE_ORDER', `Order: ${data.CatalogName} × ${data.OrderQuantity}`, currentUser?.email);
            alert("注文を登録しました");
            form.reset();
            document.getElementById('OrderMessage').innerHTML = '';
            renderOrderTablesAccordion();
        } catch (error) {
            alert("エラー: " + error);
        }
    });
}

// ===== RENDER CATALOG TABLES ACCORDION =====
function renderCatalogTablesAccordion() {
    const container = document.getElementById('catalogEntriesAccordion');
    container.innerHTML = '';
    const dbRef = ref(db, 'Catalogs/');
    get(dbRef).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const catalogs = {};
            for (const key in data) {
                const catName = data[key].CatalogName;
                if (!catalogs[catName]) catalogs[catName] = [];
                catalogs[catName].push({ ...data[key], _key: key });
            }   
            
            Object.keys(catalogs).forEach((catName, idx) => {
                const sortedEntries = catalogs[catName].slice().sort((a, b) =>
                    new Date(a.ReceiptDate || '1970-01-01') - new Date(b.ReceiptDate || '1970-01-01')
                );
                
                let prevStock = null;
                let totalReceived = 0, totalIssued = 0;
                const rowsHtml = sortedEntries.map((entry, i) => {
                    const qtyReceived = Number(entry.QuantityReceived || 0);
                    const qtyIssued = Number(entry.IssueQuantity || 0);
                    let stock = (i === 0) ? (qtyReceived - qtyIssued) : (prevStock + qtyReceived - qtyIssued);
                    prevStock = stock;
                    totalReceived += qtyReceived;
                    totalIssued += qtyIssued;
                    
                    return `<tr data-key="${entry._key}">
                        <td class="editable" data-field="CatalogName">${entry.CatalogName}</td>
                        <td class="editable" data-field="ReceiptDate">${entry.ReceiptDate}</td>
                        <td class="editable" data-field="QuantityReceived">${entry.QuantityReceived}</td>
                        <td class="editable" data-field="DeliveryDate">${entry.DeliveryDate}</td>
                        <td class="editable" data-field="IssueQuantity">${entry.IssueQuantity}</td>
                        <td><span class="calculated-stock">${stock}</span></td>
                        <td class="editable" data-field="DistributionDestination">${entry.DistributionDestination}</td>
                        <td class="editable" data-field="Requester">${entry.Requester}</td>
                        <td class="editable" data-field="Remarks">${entry.Remarks}</td>
                        <td><button class="btn btn-danger btn-sm delete-row">Delete</button></td>
                    </tr>`;
                }).join('');
                
                const section = document.createElement('div');
                section.className = 'catalog-section';
                section.innerHTML = `
                    <div class="catalog-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; margin-bottom: 12px; user-select: none;">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <i class="fas fa-chevron-down" style="transition: transform 0.2s; font-size: 14px; color: #64748b;"></i>
                            <i class='fa-solid fa-box' style="color: #2563eb;"></i>
                            <span style="font-weight: 600; color: #1e293b; font-size: 15px;">${catName}</span>
                            <span style="margin-left: auto; color: #64748b; font-size: 13px;">(${sortedEntries.length} entries)</span>
                        </div>
                    </div>
                    <div class="catalog-table-wrapper" style="display: none; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px;">
                        <table class="glass-table excel-table" data-catalog="${catName}" style="width: 100%; border-collapse: collapse;">
                            <thead style="background: #f8fafc;">
                                <tr>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">カタログ名</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">受領日</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">受領数量</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">納品日</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">発行数量</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">在庫数量</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">配布先</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">依頼者</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">備考</th>
                                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0;">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                `;
                
                container.appendChild(section);
                
                // Add click handler to header
                const header = section.querySelector('.catalog-header');
                const wrapper = section.querySelector('.catalog-table-wrapper');
                const chevron = header.querySelector('.fa-chevron-down');
                
                header.addEventListener('click', () => {
                    const isHidden = wrapper.style.display === 'none';
                    wrapper.style.display = isHidden ? 'block' : 'none';
                    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                });
            });
        }
    });
} 

// ===== RENDER ORDER TABLES ACCORDION =====
function renderOrderTablesAccordion() {
    const container = document.getElementById('orderEntriesAccordion');
    container.innerHTML = '';
    const orderRef = ref(db, 'Orders/');
    get(orderRef).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const catalogs = {};
            for (const key in data) {
                const catName = data[key].CatalogName;
                if (!catalogs[catName]) catalogs[catName] = [];
                catalogs[catName].push({ ...data[key], _key: key });
            }
            
            Object.keys(catalogs).forEach((catName, idx) => {
                const entries = catalogs[catName];
                const section = document.createElement('div');
                section.className = 'order-section';
                section.innerHTML = `
                    <div class="order-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; cursor: pointer; margin-bottom: 12px; user-select: none;">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <i class="fas fa-chevron-down" style="transition: transform 0.2s; font-size: 14px; color: #b45309;"></i>
                            <i class='fa-solid fa-cart-shopping' style="color: #f59e0b;"></i>
                            <span style="font-weight: 600; color: #1e293b; font-size: 15px;">${catName}</span>
                            <span style="margin-left: auto; color: #64748b; font-size: 13px;">(${entries.length} orders)</span>
                        </div>
                    </div>
                    <div class="order-table-wrapper" style="display: none; overflow-x: auto; border: 1px solid #fbbf24; border-radius: 8px; margin-bottom: 16px;">
                        <table class="glass-table excel-order-table" data-catalog="${catName}" style="width: 100%; border-collapse: collapse;">
                            <thead style="background: #fffbeb;">
                                <tr>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #92400e; border-bottom: 2px solid #fbbf24;">カタログ名</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #92400e; border-bottom: 2px solid #fbbf24;">注文数量</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #92400e; border-bottom: 2px solid #fbbf24;">依頼者</th>
                                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #92400e; border-bottom: 2px solid #fbbf24;">メッセージ</th>
                                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 700; color: #92400e; border-bottom: 2px solid #fbbf24;">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${entries.map(entry => `
                                    <tr data-key="${entry._key}" style="border-bottom: 1px solid #fef3c7;">
                                        <td class="editable-order" data-field="CatalogName" style="padding: 12px 16px;">${entry.CatalogName}</td>
                                        <td class="editable-order" data-field="OrderQuantity" style="padding: 12px 16px;">${entry.OrderQuantity}</td>
                                        <td class="editable-order" data-field="Requester" style="padding: 12px 16px;">${entry.Requester}</td>
                                        <td style="padding: 12px 16px;"><div style='max-width:320px;overflow-x:auto;'>${entry.Message || ''}</div></td>
                                        <td style="padding: 12px 16px; text-align: center;"><button class="btn btn-danger btn-sm delete-order-row">Delete</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                
                container.appendChild(section);
                
                // Add click handler to header
                const header = section.querySelector('.order-header');
                const wrapper = section.querySelector('.order-table-wrapper');
                const chevron = header.querySelector('.fa-chevron-down');
                
                header.addEventListener('click', () => {
                    const isHidden = wrapper.style.display === 'none';
                    wrapper.style.display = isHidden ? 'block' : 'none';
                    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                });
            });
        }
    });
}

// ===== INLINE EDITING (Tables) =====
$(document).on('click', '.excel-table .editable', function() {
    if ($(this).find('input').length) return;
    const td = $(this);
    const oldValue = td.text();
    const field = td.data('field');
    const key = td.closest('tr').data('key');
    const input = $('<input type="text" class="form-control form-control-sm">').val(oldValue);
    td.empty().append(input);
    input.focus();
    
    function saveEdit() {
        const newValue = input.val();
        if (newValue !== oldValue) {
            update(ref(db, 'Catalogs/' + key), { [field]: newValue }).then(() => {
                td.text(newValue).addClass('cell-updated');
                setTimeout(() => td.removeClass('cell-updated'), 800);
            });
        } else {
            td.text(oldValue);
        }
    }
    
    input.on('keydown', function(e) {
        if (e.key === 'Enter') saveEdit();
        else if (e.key === 'Escape') td.text(oldValue);
    }).on('blur', saveEdit);
});

$(document).on('click', '.excel-table .delete-row', async function() {
    const tr = $(this).closest('tr');
    const key = tr.data('key');
    if (confirm('削除しますか？')) {
        try {
            const snapshot = await get(ref(db, 'Catalogs/' + key));
            const catalog = snapshot.val();
            await remove(ref(db, 'Catalogs/' + key));
            await logAuditEvent('DELETE_CATALOG', `Deleted: ${catalog?.CatalogName}`, currentUser?.email);
            renderCatalogTablesAccordion();
            updateKPIs();
        } catch (error) {
            console.error('Delete error:', error);
        }
    }
});

$(document).on('click', '.excel-order-table .delete-order-row', async function() {
    const tr = $(this).closest('tr');
    const key = tr.data('key');
    if (confirm('削除しますか？')) {
        try {
            const snapshot = await get(ref(db, 'Orders/' + key));
            const order = snapshot.val();
            await remove(ref(db, 'Orders/' + key));
            await logAuditEvent('DELETE_ORDER', `Deleted order for: ${order?.CatalogName}`, currentUser?.email);
            renderOrderTablesAccordion();
        } catch (error) {
            console.error('Delete error:', error);
        }
    }
});

// ===== DATA MANAGEMENT BUTTONS =====
document.getElementById('deleteAllCatalogBtn').addEventListener('click', () => {
    if (confirm('本当に全てのカタログデータを削除しますか？')) {
        remove(ref(db, 'Catalogs/')).then(() => {
            alert('削除しました');
            renderCatalogTablesAccordion();
        });
    }
});

document.getElementById('deleteAllOrderBtn').addEventListener('click', () => {
    if (confirm('本当に全ての注文データを削除しますか？')) {
        remove(ref(db, 'Orders/')).then(() => {
            alert('削除しました');
            renderOrderTablesAccordion();
        });
    }
});

// ===== EXPORT BUTTONS =====
document.getElementById('exportCatalogCSV')?.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'Catalogs/'));
        if (!snapshot.exists()) {
            alert('No data to export');
            return;
        }
        const data = snapshot.val();
        const tableData = [['カタログ名', '受領日', '受領数量', '配送日', '発行数量', '在庫数量', '配布先', '依頼者', '備考']];
        for (const entry of Object.values(data)) {
            tableData.push([
                entry.CatalogName,
                entry.ReceiptDate,
                entry.QuantityReceived,
                entry.DeliveryDate,
                entry.IssueQuantity,
                entry.StockQuantity,
                entry.DistributionDestination,
                entry.Requester,
                entry.Remarks
            ]);
        }
        exportToCSV('catalog-export.csv', tableData);
        window.showToast('✅ Catalog exported to CSV', 'success');
    } catch (error) {
        console.error('Export error:', error);
        window.showToast('❌ Export failed', 'error');
    }
});

document.getElementById('exportCatalogPDF')?.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'Catalogs/'));
        if (!snapshot.exists()) {
            alert('No data to export');
            return;
        }
        const data = snapshot.val();
        const tableData = [['カタログ名', '受領日', '受領数量', '配送日', '発行数量', '在庫数量', '配布先', '依頼者']];
        for (const entry of Object.values(data)) {
            tableData.push([
                entry.CatalogName,
                entry.ReceiptDate,
                entry.QuantityReceived,
                entry.DeliveryDate,
                entry.IssueQuantity,
                entry.StockQuantity,
                entry.DistributionDestination,
                entry.Requester
            ]);
        }
        exportToPDF('catalog-export.pdf', 'Catalog Entries Report', tableData);
        window.showToast('✅ Catalog exported to PDF', 'success');
    } catch (error) {
        console.error('Export error:', error);
        window.showToast('❌ Export failed', 'error');
    }
});

document.getElementById('exportOrderCSV')?.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'Orders/'));
        if (!snapshot.exists()) {
            alert('No data to export');
            return;
        }
        const data = snapshot.val();
        const tableData = [['カタログ名', '注文数量', '依頼者', 'メッセージ', '注文日']];
        for (const entry of Object.values(data)) {
            tableData.push([
                entry.CatalogName,
                entry.OrderQuantity,
                entry.Requester,
                entry.Message,
                entry.OrderDate
            ]);
        }
        exportToCSV('orders-export.csv', tableData);
        window.showToast('✅ Orders exported to CSV', 'success');
    } catch (error) {
        console.error('Export error:', error);
        window.showToast('❌ Export failed', 'error');
    }
});

document.getElementById('exportOrderPDF')?.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'Orders/'));
        if (!snapshot.exists()) {
            alert('No data to export');
            return;
        }
        const data = snapshot.val();
        const tableData = [['カタログ名', '注文数量', '依頼者', 'メッセージ', '注文日']];
        for (const entry of Object.values(data)) {
            tableData.push([
                entry.CatalogName,
                entry.OrderQuantity,
                entry.Requester,
                entry.Message,
                entry.OrderDate
            ]);
        }
        exportToPDF('orders-export.pdf', 'Orders Report', tableData);
        window.showToast('✅ Orders exported to PDF', 'success');
    } catch (error) {
        console.error('Export error:', error);
        window.showToast('❌ Export failed', 'error');
    }
});

// Export Audit Log
document.getElementById('exportAuditCSV')?.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'AuditLog/'));
        if (!snapshot.exists()) {
            window.showToast('No audit data to export', 'warning');
            return;
        }
        const data = snapshot.val();
        const logs = [];
        Object.values(data).forEach(log => logs.push(log));
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const tableData = [['Timestamp', 'Action', 'Details', 'User']];
        logs.forEach(log => {
            tableData.push([
                new Date(log.timestamp).toLocaleString('ja-JP'),
                log.action,
                log.details,
                log.userId
            ]);
        });
        exportToCSV('audit-log.csv', tableData);
        window.showToast('✅ Audit log exported', 'success');
    } catch (error) {
        console.error('Export error:', error);
        window.showToast('❌ Export failed', 'error');
    }
});

// Export Movement History
document.getElementById('exportMovementCSV')?.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'MovementHistory/'));
        if (!snapshot.exists()) {
            window.showToast('No movement data to export', 'warning');
            return;
        }
        const data = snapshot.val();
        const movements = [];
        Object.values(data).forEach(m => movements.push(m));
        movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const tableData = [['Timestamp', 'Item', 'Old Stock', 'New Stock', 'Change', 'Action']];
        movements.forEach(m => {
            tableData.push([
                new Date(m.timestamp).toLocaleString('ja-JP'),
                m.catalogName,
                m.oldStock,
                m.newStock,
                m.change,
                m.action
            ]);
        });
        exportToCSV('movement-history.csv', tableData);
        window.showToast('✅ Movement history exported', 'success');
    } catch (error) {
        console.error('Export error:', error);
        window.showToast('❌ Export failed', 'error');
    }
});

document.getElementById('generateSampleCatalogBtn').addEventListener('click', () => {
    const destinations = ["東京工場", "大阪工場", "名古屋工場"];
    const requesters = ["田中", "佐藤", "鈴木"];
    let count = 0;
    
    CATALOG_NAMES.slice(0, 5).forEach((catName, i) => {
        for (let j = 0; j < 3; j++) {
            const baseDate = new Date(2025, 5, 1 + j);
            const entry = {
                CatalogName: catName,
                ReceiptDate: baseDate.toISOString().slice(0, 10),
                QuantityReceived: Math.floor(Math.random() * 100) + 10,
                DeliveryDate: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                IssueQuantity: Math.floor(Math.random() * 50),
                StockQuantity: 50,
                DistributionDestination: destinations[i % destinations.length],
                Requester: requesters[i % requesters.length],
                Remarks: j === 0 ? "初回入庫" : ""
            };
            set(ref(db, "Catalogs/" + catName + "_" + j + "_" + Date.now()), entry);
            count++;
        }
    });
    alert('サンプルデータ(' + count + '件)を生成しました');
    renderCatalogTablesAccordion();
    updateKPIs();
});

document.getElementById('generateSampleOrderBtn').addEventListener('click', () => {
    const requesters = ["田中", "佐藤", "鈴木"];
    const now = Date.now();
    CATALOG_NAMES.slice(0, 5).forEach((catName, i) => {
        for (let j = 0; j < 2; j++) {
            const order = {
                CatalogName: catName,
                OrderQuantity: Math.floor(Math.random() * 50) + 1,
                Requester: requesters[i % requesters.length],
                Message: `注文 ${i + 1}`,
                OrderDate: '2025-07-01'
            };
            set(ref(db, "Orders/" + catName + "_" + (now + i + j)), order);
        }
    });
    alert('サンプル注文データを生成しました');
    renderOrderTablesAccordion();
});

// ===== CALENDAR =====
function initializeCalendar() {
    const calendarEl = document.getElementById('stockCalendarContent');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
        events: function(info, successCallback) {
            const events = [];
            const catalogRef = ref(db, 'Catalogs/');
            onValue(catalogRef, (snapshot) => {
                if (snapshot.exists()) {
                    Object.values(snapshot.val()).forEach(entry => {
                        events.push({
                            title: entry.CatalogName,
                            start: entry.DeliveryDate,
                            extendedProps: {
                                stock: entry.StockQuantity,
                                requester: entry.Requester
                            }
                        });
                    });
                }
                successCallback(events);
            });
        }
    });
    calendar.render();
}

// ===== ANALYTICS =====
const ANALYTICS_CARDS = [
    { key: 'totalStock', label: '総在庫数', icon: 'fa-boxes-stacked' },
    { key: 'totalOrders', label: '総注文数', icon: 'fa-cart-shopping' },
    { key: 'avgOrderQty', label: '平均注文数量', icon: 'fa-divide' },
    { key: 'stockByItem', label: 'カタログ別在庫', icon: 'fa-layer-group' },
    { key: 'ordersByItem', label: 'カタログ別注文', icon: 'fa-list-ol' },
];

function getAnalyticsSelection() {
    return JSON.parse(localStorage.getItem('analyticsSelection') || JSON.stringify(ANALYTICS_CARDS.map(c => c.key)));
}

function fetchAndRenderAnalytics() {
    get(ref(db, 'Catalogs/')).then(cSnap => {
        const catalogData = cSnap.exists() ? cSnap.val() : {};
        get(ref(db, 'Orders/')).then(oSnap => {
            const orderData = oSnap.exists() ? oSnap.val() : {};
            renderAnalyticsDashboard(catalogData, orderData);
        });
    });
}

function renderAnalyticsDashboard(catalogData, orderData) {
    const selection = getAnalyticsSelection();
    const container = document.getElementById('analyticsCards');
    container.innerHTML = '';
    
    ANALYTICS_CARDS.forEach(card => {
        if (selection.includes(card.key)) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'glass-card';
            cardDiv.innerHTML = `<h2><i class="fa-solid ${card.icon}"></i> ${card.label}</h2><div id="analytics-${card.key}"></div>`;
            container.appendChild(cardDiv);
            
            if (card.key === 'totalStock') {
                let total = 0;
                Object.values(catalogData).forEach(e => total += Number(e.StockQuantity || 0));
                document.getElementById('analytics-totalStock').innerHTML = `<div style="font-size:2.2rem;font-weight:600;color:#232946;">${total}</div>`;
            } else if (card.key === 'totalOrders') {
                document.getElementById('analytics-totalOrders').innerHTML = `<div style="font-size:2.2rem;font-weight:600;color:#232946;">${Object.keys(orderData).length}</div>`;
            } else if (card.key === 'avgOrderQty') {
                const orders = Object.values(orderData);
                if (orders.length === 0) {
                    document.getElementById('analytics-avgOrderQty').innerHTML = '<span>--</span>';
                } else {
                    let total = 0;
                    orders.forEach(o => total += Number(o.OrderQuantity || 0));
                    document.getElementById('analytics-avgOrderQty').innerHTML = `<div style="font-size:2.2rem;font-weight:600;color:#232946;">${(total / orders.length).toFixed(1)}</div>`;
                }
            } else if (card.key === 'stockByItem') {
                const byItem = {};
                Object.values(catalogData).forEach(e => { byItem[e.CatalogName] = (byItem[e.CatalogName] || 0) + Number(e.StockQuantity || 0); });
                const ctxId = 'stockByItem-chart';
                const container = document.getElementById('analytics-stockByItem');
                let canvas = document.getElementById(ctxId);
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.id = ctxId;
                    container.appendChild(canvas); container.appendchild    
                }
                if (window.stockByItemChart) window.stockByItemChart.destroy();
                window.stockByItemChart = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(byItem),
                        datasets: [{ label: '在庫数量', data: Object.values(byItem), backgroundColor: 'rgba(75,192,192,0.5)' }]
                    },
                    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });
            } else if (card.key === 'ordersByItem') {
                const byItem = {};
                Object.values(orderData).forEach(e => { byItem[e.CatalogName] = (byItem[e.CatalogName] || 0) + 1; });
                const ctxId = 'ordersByItem-chart';
                const container = document.getElementById('analytics-ordersByItem');
                let canvas = document.getElementById(ctxId);
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.id = ctxId;
                    container.appendChild(canvas);
                }
                if (window.ordersByItemChart) window.ordersByItemChart.destroy();
                window.ordersByItemChart = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(byItem),
                        datasets: [{ label: '注文数', data: Object.values(byItem), backgroundColor: 'rgba(153,102,255,0.5)' }]
                    },
                    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });
            }
        }
    });
}

// Analytics customization modal
document.getElementById('analyticsCustomizeForm').innerHTML = ANALYTICS_CARDS.map(card =>
    `<div class="form-check">
        <input class="form-check-input" type="checkbox" value="${card.key}" id="chk${card.key}">
        <label class="form-check-label" for="chk${card.key}">${card.label}</label>
    </div>`
).join('');

document.getElementById('customizeAnalyticsBtn').addEventListener('click', () => {
    const selection = getAnalyticsSelection();
    document.querySelectorAll('#analyticsCustomizeForm input').forEach(chk => {
        chk.checked = selection.includes(chk.value);
    });
    $('#analyticsCustomizeModal').modal('show'); initiate(maximum)
});

document.getElementById('saveAnalyticsCustomize').addEventListener('click', () => {
    document.querySelectorAll('#analyticsCustomizeForm input:checked').forEach(chk => {
        selected.push(chk.value);
    });
    if (selected.length === 0) {
        alert('少なくとも1つ選択してください');
        return;
    }
    localStorage.setItem('analyticsSelection', JSON.stringify(selected));
    $('#analyticsCustomizeModal').modal('hide');
    fetchAndRenderAnalytics();
});

// Date range filter
document.getElementById('analyticsDatePreset').addEventListener('change', function() {
    if (this.value === 'custom') {
        document.getElementById('analyticsDateStart').style.display = 'block';
        document.getElementById('analyticsDateEnd').style.display = 'block';
        document.getElementById('analyticsDateDash').style.display = 'block';
    } else {
        document.getElementById('analyticsDateStart').style.display = 'none';
        document.getElementById('analyticsDateEnd').style.display = 'none';
        document.getElementById('analyticsDateDash').style.display = 'none';
        fetchAndRenderAnalytics();
    }
});

// ===== MOBILE HAMBURGER TOGGLE =====
function initMobileToggle() {
    const toggle = document.getElementById('hamburgerToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });
    
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
}

// ===== INITIALIZE ON DOM READY =====
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state before initializing app
    onAuthStateChanged(async (user) => {
        // Initialize app components regardless of auth state (allow demo mode)
        
        if (user) {
            // Store current user globally
            currentUser = user;

            // Update last login timestamp
            await updateLastLogin(user.uid);

            // Fetch user permissions
            userPermissions = await getUserPermissions(user.uid);

            if (!userPermissions) {
                console.error('Failed to load user permissions');
                showNotification('Error loading permissions. Please refresh the page.', 'error');
                return;
            }

            // Small delay to ensure permissions are fully loaded
            await new Promise(resolve => setTimeout(resolve, 100));

            // Initialize role-based navigation
            const userRole = userPermissions.role || 'user';
            initRoleBasedNavigation(userRole);

            // Filter tabs based on permissions
            await filterTabsByPermissions(userPermissions);

            // Display user info
            updateUserDisplay(user);

            // Setup logout handler
            setupLogoutHandler();

            console.log('✓ Application initialized | User:', user.email);
        } else {
            // Demo mode for unauthenticated users
            console.log('⚠ Demo mode: No user authenticated. Showing all tabs.');
            
            // Set demo user display
            const userEmailInline = document.getElementById('userEmailInline');
            const userEmail = document.getElementById('userEmail');
            const userRole = document.getElementById('userRole');
            const userRoleInline = document.getElementById('userRoleInline');
            
            if (userEmailInline) userEmailInline.textContent = 'demo@example.com';
            if (userEmail) userEmail.textContent = 'demo@example.com';
            if (userRole) userRole.textContent = 'Demo';
            if (userRoleInline) userRoleInline.textContent = 'Demo';
            
            // Show all nav buttons in demo mode
            document.querySelectorAll('.nav-link-btn, .sidebar-nav-btn').forEach(btn => btn.style.display = 'inline-block');
            document.querySelectorAll('.nav-group-divider').forEach(div => div.style.display = 'inline-block');
            
            // Show ALL tabs in demo mode
            document.querySelectorAll('.tab-section').forEach(tab => tab.style.display = 'block');
        }

        // Initialize app components
        initializeCatalogSelects();
        initTabSwitching();
        initCatalogForm();
        initOrderForm();
        initMobileToggle();
        initAdminPanel();  

        console.log('✓ Application initialized');
    });  
});

// ===== FILTER TABS BY PERMISSIONS =====
async function filterTabsByPermissions(permissions) {
    console.log('Filtering tabs with permissions:', permissions);
    
    // On GitHub Pages, always show all tabs for demo purposes
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    const tabConfig = {
        'manageCatalog': { label: 'Manage Catalog', permission: 'manageCatalog' },
        'placeOrder': { label: 'Place Order', permission: 'placeOrder' },
        'catalogEntries': { label: 'Catalog Entries', permission: 'catalogEntries' },
        'orderEntries': { label: 'Order Entries', permission: 'orderEntries' },
        'reports': { label: 'Reports', permission: 'reports' },
        'stockCalendar': { label: 'Stock Calendar', permission: 'stockCalendar' },
        'analytics': { label: 'Analytics', permission: 'analytics' },
        'adminPanel': { label: 'Admin Panel', permission: 'userManagement' }
    };

    document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
        const tabId = btn.getAttribute('data-tab');
        const tabConfig_item = tabConfig[tabId];

        // On GitHub Pages, show all tabs
        if (isGitHubPages) {
            console.log('GitHub Pages detected - showing all tabs');
            btn.style.display = 'block';
            return;
        }

        if (tabConfig_item && permissions[tabConfig_item.permission]) {
            if (permissions[tabConfig_item.permission].read === true) {
                console.log('Showing tab:', tabId);
                btn.style.display = 'block';
            } else {
                console.log('Hiding tab (no read):', tabId);
                btn.style.display = 'none';
            }
        } else {
            console.log('Hiding tab (not in config):', tabId);
            btn.style.display = 'none';
        }
    });

    // Make first visible tab active
    const firstVisibleBtn = document.querySelector('.sidebar-nav-btn[style="display: block"]');
    if (firstVisibleBtn) {
        console.log('Activating first visible tab:', firstVisibleBtn.getAttribute('data-tab'));
        firstVisibleBtn.click();  
    }
}

// ===== UPDATE USER DISPLAY =====
function updateUserDisplay(user) {
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');
    const userEmailInline = document.getElementById('userEmailInline');
    const userRoleInline = document.getElementById('userRoleInline');

    if (userEmail) {
        userEmail.textContent = user.email;
    }
    if (userEmailInline) {
        userEmailInline.textContent = user.email;
    }

    if ((userRole || userRoleInline) && currentUser) {
        // Set role display (will be updated with actual role from database)
        if (userRole) userRole.textContent = 'Loading...';
        if (userRoleInline) userRoleInline.textContent = 'Loading...';

        // Fetch actual role from database
        const userRef = ref(db, `Users/${user.uid}`);
        get(userRef).then(snapshot => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const roleText = userData.role === 'admin' ? 'Admin' : 'User';
                if (userRole) {
                    userRole.textContent = roleText;
                }
                if (userRoleInline) {
                    userRoleInline.textContent = roleText;
                }
            }
        });
    }
}

// ===== LOGOUT HANDLER =====
function setupLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (confirm('Are you sure you want to logout?')) {
                try {
                    await logoutUser();
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    showNotification('Logout failed. Please try again.', 'error');
                }
            }
        });
    }
    
    const logoutBtnTop = document.getElementById('logoutBtnTop');
    if (logoutBtnTop) {
        logoutBtnTop.addEventListener('click', async (e) => {
            e.preventDefault();

            if (confirm('Are you sure you want to logout?')) {
                try {
                    await logoutUser();
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    showNotification('Logout failed. Please try again.', 'error');
                } 
            }
        });
    }  
}

// ===== NOTIFICATION HELPER =====
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#fee' : type === 'success' ? '#efe' : '#eef'};
        color: ${type === 'error' ? '#c33' : type === 'success' ? '#3c3' : '#33c'};
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
} // the possible tasks that has to be done

// ===== RICH TEXT FORMATTING =====
window.formatOrderMsg = function(cmd) {
    const msgDiv = document.getElementById('OrderMessage');
    msgDiv.focus();
    document.execCommand(cmd, false, null);
};

// ===== EXPORT FUNCTIONS =====
function exportToCSV(filename, tableData) {
    const csv = tableData.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function exportToPDF(filename, title, tableData) {
    let html = `<h2>${title}</h2><table border="1"><thead><tr>`;
    if (tableData.length > 0) {
        tableData[0].forEach(header => html += `<th>${header}</th>`);
        html += '</tr></thead><tbody>';
        tableData.slice(1).forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<td>${cell}</td>`);
            html += '</tr>';
        });
    }
    html += '</tbody></table>';
    const newWindow = window.open('', '', 'height=600,width=1000');
    newWindow.document.write(html);
    newWindow.document.close();
    setTimeout(() => newWindow.print(), 250);
}

// ===== KPI CALCULATOR =====
async function updateKPIs() {
    try {
        const catalogRef = ref(db, 'ManageCatalog');
        const entriesRef = ref(db, 'ManageCatalogEntries');
        const snapshot = await get(catalogRef);
        const entriesSnapshot = await get(entriesRef);
        
        let totalCatalogs = 0;
        let totalItems = 0;
        let distributionMap = {};
        let pendingCount = 0;
        
        // Count catalogs and total items in stock
        if (snapshot.exists()) {
            const catalogs = snapshot.val();
            totalCatalogs = Object.keys(catalogs).length;
            
            for (const [key, catalog] of Object.entries(catalogs)) {
                totalItems += parseInt(catalog.Stock || 0);
            }
        }
        
        // Count pending distributions and track most distributed
        if (entriesSnapshot.exists()) {
            const entries = entriesSnapshot.val();
            
            for (const [key, entry] of Object.entries(entries)) {
                const catalogName = entry.CatalogName || 'Unknown';
                distributionMap[catalogName] = (distributionMap[catalogName] || 0) + (parseInt(entry.IssueQuantity) || 0);
                
                // Count as pending if delivery date is in future
                const deliveryDate = new Date(entry.DeliveryDate);
                if (deliveryDate > new Date()) {
                    pendingCount++;
                }
            }
        }
        
        // Find most distributed catalog
        let mostDist = '-';
        let maxCount = 0;
        for (const [name, count] of Object.entries(distributionMap)) {
            if (count > maxCount) {
                maxCount = count;
                mostDist = name.substring(0, 20);
            }
        }
        
        document.getElementById('kpiTotalCatalogs').textContent = totalCatalogs;
        document.getElementById('kpiTotalItems').textContent = totalItems;
        document.getElementById('kpiPendingDist').textContent = pendingCount;
        document.getElementById('kpiMostDist').textContent = mostDist;
    } catch (error) {
        console.error('Error updating KPIs:', error);
    }
}

// ===== PRODUCT BROWSING & ORDERING =====
async function renderProductBrowser() {
    try {
        const catalogRef = ref(db, 'ManageCatalog');
        const entriesRef = ref(db, 'ManageCatalogEntries');
        
        const catalogSnapshot = await get(catalogRef);
        const entriesSnapshot = await get(entriesRef);
        
        // Build product list from entries
        const products = [];
        const catalogMap = {};
        
        if (catalogSnapshot.exists()) {
            Object.entries(catalogSnapshot.val()).forEach(([key, catalog]) => {
                catalogMap[catalog.CatalogName] = catalog;
            });
        }
        
        if (entriesSnapshot.exists()) {
            Object.entries(entriesSnapshot.val()).forEach(([key, entry]) => {
                const catalogName = entry.CatalogName;
                const stock = parseInt(entry.StockQuantity || 0);
                
                products.push({
                    id: key,
                    name: catalogName,
                    catalog: catalogName,
                    stock: stock,
                    status: stock === 0 ? 'out' : stock < 10 ? 'low' : 'available',
                    receiptDate: entry.ReceiptDate,
                    deliveryDate: entry.DeliveryDate
                });
            });
        }
        
        // Populate filter dropdowns
        const catalogFilterSelect = document.getElementById('productFilterCatalog');
        const catalogs = [...new Set(products.map(p => p.catalog))];
        catalogs.forEach(catalog => {
            const option = document.createElement('option');
            option.value = catalog;
            option.textContent = catalog;
            catalogFilterSelect.appendChild(option);
        });
        
        // Render products
        renderProductGrid(products, products);
        
        // Setup filter handlers
        setupProductFilters(products);
        
    } catch (error) {
        console.error('Error rendering product browser:', error);
        document.getElementById('productsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 32px; color: #999;">Error loading products</div>';
    }
}

function renderProductGrid(allProducts, filteredProducts) {
    const grid = document.getElementById('productsGrid');
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 32px; color: #999;">No products found</div>';
        return;
    }
    
    let html = '';
    filteredProducts.forEach(product => {
        const statusClass = product.status;
        const statusLabel = {
            'available': '✅ In Stock',
            'low': '⚠️ Low Stock',
            'out': '❌ Out of Stock'
        }[product.status] || 'Unknown';
        
        html += `
            <div class="product-card">
                <div class="product-card-header">${product.name.substring(0, 25)}...</div>
                <div class="product-card-body">
                    <div class="product-card-status ${statusClass}">${statusLabel}</div>
                    <div class="product-card-info">
                        <span>Stock:</span>
                        <strong>${product.stock} units</strong>
                    </div>
                    <div class="product-card-info">
                        <span>Delivery:</span>
                        <strong>${product.deliveryDate || '-'}</strong>
                    </div>
                    <div class="product-card-actions">
                        <button class="btn btn-info" onclick="addProductToOrder('${product.name}', ${product.stock})">Add to Order</button>
                        <button class="btn btn-outline-secondary" onclick="viewProductDetails('${product.id}')">Details</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function setupProductFilters(allProducts) {
    const searchBox = document.getElementById('productSearchBox');
    const catalogFilter = document.getElementById('productFilterCatalog');
    const statusFilter = document.getElementById('productFilterStatus');
    const clearBtn = document.getElementById('clearFiltersBtn');
    
    function applyFilters() {
        let filtered = allProducts;
        
        // Search filter
        const searchTerm = searchBox.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
        }
        
        // Catalog filter
        const catalogValue = catalogFilter.value;
        if (catalogValue) {
            filtered = filtered.filter(p => p.catalog === catalogValue);
        }
        
        // Status filter
        const statusValue = statusFilter.value;
        if (statusValue) {
            filtered = filtered.filter(p => p.status === statusValue);
        }
        
        renderProductGrid(allProducts, filtered);
    }
    
    searchBox.addEventListener('input', applyFilters);
    catalogFilter.addEventListener('change', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    clearBtn.addEventListener('click', () => {
        searchBox.value = '';
        catalogFilter.value = '';
        statusFilter.value = '';
        renderProductGrid(allProducts, allProducts);
    });
}

function addProductToOrder(catalogName, availableStock) {
    const quantityInput = document.getElementById('QuickOrderQuantity');
    const catalogSelect = document.getElementById('QuickOrderCatalog');
    
    catalogSelect.value = catalogName;
    quantityInput.value = 1;
    quantityInput.max = Math.max(1, availableStock);
    
    // Scroll to quick order section
    document.getElementById('quickOrderForm').scrollIntoView({ behavior: 'smooth' });
}

function viewProductDetails(productId) {
    // Could expand to show more details in a modal
    window.showToast('📌 Product ID: ' + productId, 'info');
}

// ===== SMART NOTIFICATIONS SYSTEM =====
let activeNotifications = [];

async function initializeSmartNotifications() {
    try {
        // Setup notification badge click handler
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', showNotificationCenter);
        }
        
        // Scan for alerts periodically
        checkForAlerts();
        setInterval(checkForAlerts, 60000); // Check every minute
        
    } catch (error) {
        console.error('Error initializing notifications:', error);
    }
}

async function checkForAlerts() {
    try {
        const entriesRef = ref(db, 'ManageCatalogEntries');
        const snapshot = await get(entriesRef);
        
        if (!snapshot.exists()) return;
        
        activeNotifications = [];
        const entries = snapshot.val();
        
        for (const [key, entry] of Object.entries(entries)) {
            const stock = parseInt(entry.StockQuantity || 0);
            const catalogName = entry.CatalogName;
            
            // Alert: Out of stock
            if (stock === 0) {
                activeNotifications.push({
                    id: key,
                    type: 'critical',
                    title: '❌ Out of Stock',
                    message: `${catalogName} has no items left`,
                    timestamp: new Date()
                });
            }
            // Alert: Low stock
            else if (stock < 5) {
                activeNotifications.push({
                    id: key,
                    type: 'warning',
                    title: '⚠️ Low Stock',
                    message: `${catalogName} has only ${stock} items`,
                    timestamp: new Date()
                });
            }
        }
        
        // Update badge
        updateNotificationBadge(activeNotifications.length);
        
    } catch (error) {
        console.error('Error checking alerts:', error);
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function showNotificationCenter() {
    if (activeNotifications.length === 0) {
        window.showToast('✅ No alerts at this time!', 'success');
        return;
    }
    
    let notificationHtml = '<div style="max-height: 400px; overflow-y: auto;">';
    activeNotifications.forEach(notif => {
        const bgColor = notif.type === 'critical' ? '#fee2e2' : '#fef3c7';
        const borderColor = notif.type === 'critical' ? '#fca5a5' : '#fcd34d';
        
        notificationHtml += `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 12px; margin-bottom: 8px; border-radius: 6px;">
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${notif.title}</div>
                <div style="font-size: 12px; color: #666;">${notif.message}</div>
            </div>
        `;
    });
    notificationHtml += '</div>';
    
    // Create modal or show in alert
    const modal = `
        <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; margin: 0 auto;">
            <h3 style="margin-top: 0; color: #1e293b;">📢 Notifications (${activeNotifications.length})</h3>
            ${notificationHtml}
            <button onclick="closeNotificationCenter()" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Dismiss</button>
        </div>
    `;
    
    // Simple alert for now (can be upgraded to modal)
    alert(`You have ${activeNotifications.length} active alerts. Check the dashboard for details.`);
}

function closeNotificationCenter() {
    // Close notification center
}

// ===== PERIODIC SMART FEATURES UPDATE =====
setInterval(() => {
    if (document.getElementById('tab-manageCatalog').style.display === 'block') {
        renderSmartInsights();
    }
}, 30000); // Update every 30 seconds when on dashboard

// ===== DASHBOARD RENDERER =====
async function renderDashboard() {
    try {
        // Update dashboard summary stats
        const catalogRef = ref(db, 'ManageCatalog');
        const entriesRef = ref(db, 'ManageCatalogEntries');
        
        const catalogSnapshot = await get(catalogRef);
        const entriesSnapshot = await get(entriesRef);
        
        let totalRecords = 0;
        let completedRecords = 0;
        
        if (entriesSnapshot.exists()) {
            const entries = entriesSnapshot.val();
            totalRecords = Object.keys(entries).length;
            
            // Count completed (where DeliveryDate has passed)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            for (const [key, entry] of Object.entries(entries)) {
                const deliveryDate = new Date(entry.DeliveryDate);
                if (deliveryDate < today) {
                    completedRecords++;
                }
            }
        }
        
        const completionRate = totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 100) : 0;
        
        document.getElementById('dashTotalRecords').textContent = totalRecords;
        document.getElementById('dashCompleted').textContent = completedRecords;
        document.getElementById('dashCompletionRate').textContent = completionRate + '%';
        
        // Render activity feed
        await renderActivityFeed();
        
        // Render smart insights
        await renderSmartInsights();
        
    } catch (error) {
        console.error('Error rendering dashboard:', error);
    }
}

async function renderSmartInsights() {
    try {
        const entriesRef = ref(db, 'ManageCatalogEntries');
        const snapshot = await get(entriesRef);
        
        if (!snapshot.exists()) {
            document.getElementById('lowStockAlertBox').style.display = 'none';
            document.getElementById('topDemandList').innerHTML = '<div style="padding: 6px 0; color: #999;">No data</div>';
            return;
        }
        
        const entries = snapshot.val();
        const catalogDemand = {};
        const stockLevels = {};
        
        for (const [key, entry] of Object.entries(entries)) {
            const catalogName = entry.CatalogName;
            const stock = parseInt(entry.StockQuantity || 0);
            const issued = parseInt(entry.IssueQuantity || 0);
            
            // Track stock levels
            stockLevels[catalogName] = stock;
            
            // Track demand (issued quantity)
            if (!catalogDemand[catalogName]) {
                catalogDemand[catalogName] = 0;
            }
            catalogDemand[catalogName] += issued;
        }
        
        // === LOW STOCK ALERTS ===
        const lowStockItems = Object.entries(stockLevels)
            .filter(([name, stock]) => stock < 5)
            .map(([name, stock]) => ({ name, stock }))
            .sort((a, b) => a.stock - b.stock);
        
        const lowStockBox = document.getElementById('lowStockAlertBox');
        const lowStockList = document.getElementById('lowStockList');
        
        if (lowStockItems.length > 0) {
            lowStockBox.style.display = 'block';
            let html = '';
            lowStockItems.forEach(item => {
                html += `<div style="padding: 4px 0;">• ${item.name.substring(0, 25)}: <strong>${item.stock} left</strong></div>`;
            });
            lowStockList.innerHTML = html;
            
            // Show toast notification for critical items
            const criticalItems = lowStockItems.filter(i => i.stock === 0);
            if (criticalItems.length > 0) {
                window.showToast(`🔴 ${criticalItems.length} item(s) out of stock!`, 'danger');
            }
        } else {
            lowStockBox.style.display = 'none';
        }
        
        // === TOP DEMAND INSIGHTS ===
        const topDemand = Object.entries(catalogDemand)
            .map(([name, demand]) => ({ name, demand }))
            .sort((a, b) => b.demand - a.demand)
            .slice(0, 5);
        
        const topDemandList = document.getElementById('topDemandList');
        if (topDemand.length > 0) {
            let html = '';
            topDemand.forEach((item, index) => {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                html += `<div style="padding: 6px 0; display: flex; justify-content: space-between;">
                    <span>${medals[index]} ${item.name.substring(0, 20)}...</span>
                    <strong>${item.demand} orders</strong>
                </div>`;
            });
            topDemandList.innerHTML = html;
        } else {
            topDemandList.innerHTML = '<div style="padding: 6px 0; color: #999;">No demand data yet</div>';
        }
        
    } catch (error) {
        console.error('Error rendering smart insights:', error);
    }
}

async function renderActivityFeed() {
    try {
        const auditRef = ref(db, 'AuditLog');
        const snapshot = await get(auditRef);
        const container = document.getElementById('activityFeed');
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="activity-feed-empty">No activities yet</div>';
            return;
        }
        
        const activities = snapshot.val();
        const activityArray = [];
        
        for (const [key, activity] of Object.entries(activities)) {
            activityArray.push({
                timestamp: activity.timestamp,
                action: activity.action,
                details: activity.details,
                userId: activity.userId
            });
        }
        
        // Sort by timestamp descending and take last 15
        activityArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recentActivities = activityArray.slice(0, 15);
        
        if (recentActivities.length === 0) {
            container.innerHTML = '<div class="activity-feed-empty">No recent activities</div>';
            return;
        }
        
        let html = '';
        recentActivities.forEach(activity => {
            const timestamp = new Date(activity.timestamp);
            const timeAgo = getTimeAgo(timestamp);
            const icon = getActivityIcon(activity.action);
            const displayAction = formatActivityAction(activity.action);
            
            html += `
                <div class="activity-feed-item">
                    <div class="activity-feed-icon">${icon}</div>
                    <div class="activity-feed-content">
                        <div class="activity-feed-action">${displayAction}</div>
                        <div class="activity-feed-details">${activity.details || activity.userId || 'Unknown'}</div>
                    </div>
                    <div class="activity-feed-time">${timeAgo}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error rendering activity feed:', error);
        document.getElementById('activityFeed').innerHTML = '<div class="activity-feed-empty">Error loading activities</div>';
    }
}

function getActivityIcon(action) {
    const icons = {
        'CREATE': '✅',
        'UPDATE': '✏️',
        'DELETE': '🗑️',
        'LOGOUT': '👋',
        'LOGIN': '🔐',
        'APPROVE': '✔️',
        'REJECT': '❌',
        'EXPORT': '📥',
        'IMPORT': '📤'
    };
    return icons[action] || '📌';
}

function formatActivityAction(action) {
    const actionMap = {
        'CREATE': 'Created Entry',
        'UPDATE': 'Updated Entry',
        'DELETE': 'Deleted Entry',
        'LOGOUT': 'Logged Out',
        'LOGIN': 'Logged In',
        'APPROVE': 'Approved',
        'REJECT': 'Rejected',
        'EXPORT': 'Exported Data',
        'IMPORT': 'Imported Data'
    };
    return actionMap[action] || action;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    
    return date.toLocaleDateString();
}

// Helper function to switch tabs from dashboard buttons
function switchTab(event, tabName) {
    if (event) event.preventDefault();
    
    document.querySelectorAll('.tab-section').forEach(tab => tab.style.display = 'none');
    const tab = document.getElementById('tab-' + tabName);
    if (tab) {
        tab.style.display = 'block';
        
        // Lazy load if needed
        if (tabName === 'catalogEntries') renderCatalogTablesAccordion();
        if (tabName === 'orderEntries') renderOrderTablesAccordion();
        if (tabName === 'placeOrder') renderProductBrowser();
        if (tabName === 'stockCalendar' && !window.calendarInitialized) {
            initializeCalendar();
            window.calendarInitialized = true;
        }
    }
    
    // Update active states for all nav buttons
    document.querySelectorAll('.nav-link-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[data-tab="' + tabName + '"]').forEach(b => b.classList.add('active'));
    
    // Also update sidebar buttons if visible
    document.querySelectorAll('.sidebar-nav-btn').forEach(b => {
        if (b.getAttribute('data-tab') === tabName) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

// ===== PERIODIC KPI UPDATE =====
setInterval(updateKPIs, 30000); // Update every 30 seconds
async function logAuditEvent(action, details, userId = 'unknown') {
    try {
        const timestamp = new Date().toISOString();
        const auditEntry = {
            action,
            details,
            userId,
            timestamp
        };
        await set(ref(db, `AuditLog/${Date.now()}`), auditEntry);
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

async function renderAuditLog() {
    try {
        const snapshot = await get(ref(db, 'AuditLog'));
        const container = document.getElementById('auditLogContent');
        if (!container) return;
        
        container.innerHTML = '';
        if (!snapshot.exists()) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No audit entries yet</p>';
            return;
        }
        
        const logs = [];
        snapshot.forEach(child => {
            logs.push({ id: child.key, ...child.val() });
        });
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const tableHtml = `
            <table class="glass-table" style="width: 100%;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>User</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td style="font-size: 13px;">${new Date(log.timestamp).toLocaleString('ja-JP')}</td>
                            <td><strong>${log.action}</strong></td>
                            <td style="font-size: 13px;">${log.details}</td>
                            <td style="font-size: 13px;">${log.userId}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    } catch (error) {
        console.error('Error rendering audit log:', error);
    }
}

// ===== MOVEMENT HISTORY =====
async function logMovement(catalogName, oldStock, newStock, action) {
    try {
        const timestamp = new Date().toISOString();
        const movement = {
            catalogName,
            oldStock: Number(oldStock),
            newStock: Number(newStock),
            change: Number(newStock) - Number(oldStock),
            action,
            timestamp
        };
        await set(ref(db, `MovementHistory/${Date.now()}`), movement);
        await logAuditEvent('INVENTORY_CHANGE', `${catalogName}: ${oldStock} → ${newStock}`, currentUser?.email);
    } catch (error) {
        console.error('Movement log error:', error);
    }
}

async function renderMovementHistory() {
    try {
        const snapshot = await get(ref(db, 'MovementHistory'));
        const container = document.getElementById('movementHistoryContent');
        if (!container) return;
        
        container.innerHTML = '';
        if (!snapshot.exists()) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No movement history yet</p>';
            return;
        }
        
        const movements = [];
        snapshot.forEach(child => {
            movements.push({ id: child.key, ...child.val() });
        });
        movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const tableHtml = `
            <table class="glass-table" style="width: 100%;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th>Timestamp</th>
                        <th>Item</th>
                        <th>Old Stock</th>
                        <th>New Stock</th>
                        <th>Change</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${movements.map(m => {
                        const changeColor = m.change > 0 ? '#10b981' : m.change < 0 ? '#ef4444' : '#999';
                        return `
                            <tr>
                                <td style="font-size: 13px;">${new Date(m.timestamp).toLocaleString('ja-JP')}</td>
                                <td><strong>${m.catalogName?.substring(0, 40)}</strong></td>
                                <td>${m.oldStock}</td>
                                <td>${m.newStock}</td>
                                <td style="color: ${changeColor}; font-weight: 600;">${m.change > 0 ? '+' : ''}${m.change}</td>
                                <td style="font-size: 13px;">${m.action}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    } catch (error) {
        console.error('Error rendering movement history:', error);
    }
}

// ===== BULK OPERATIONS =====
async function openBulkEditModal() {
    try {
        const snapshot = await get(ref(db, 'Catalogs'));
        if (!snapshot.exists()) {
            window.showToast('No items to edit', 'warning');
            return;
        }
        
        const catalogs = [];
        snapshot.forEach(child => {
            catalogs.push({ id: child.key, ...child.val() });
        });
        
        const html = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;" id="bulkEditOverlay">
                <div style="background: white; border-radius: 12px; padding: 24px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0;">Bulk Edit Items</h3>
                        <button onclick="document.getElementById('bulkEditOverlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
                    </div>
                    
                    <div style="margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Apply to all items:</label>
                        <div style="display: flex; gap: 12px;">
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: #666;">Increase Price by (%):</label>
                                <input type="number" id="bulkPriceIncrease" placeholder="0" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: #666;">Add to Stock:</label>
                                <input type="number" id="bulkStockAdd" placeholder="0" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                            </div>
                        </div>
                        <button onclick="bulkApplyChanges()" class="btn btn-primary" style="margin-top: 12px; width: 100%;">Apply Changes</button>
                    </div>
                    
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                        <h4>Individual Items</h4>
                        <table class="glass-table" style="width: 100%; font-size: 13px;">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Stock</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${catalogs.map((cat, idx) => `
                                    <tr>
                                        <td>${cat.CatalogName?.substring(0, 30)}</td>
                                        <td>${cat.StockQuantity}</td>
                                        <td>
                                            <button onclick="bulkDeleteItem('${cat.id}')" class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 12px;">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
    } catch (error) {
        console.error('Bulk edit error:', error);
        window.showToast('❌ Error opening bulk edit', 'error');
    }
}

async function bulkApplyChanges() {
    try {
        const priceIncrease = parseFloat(document.getElementById('bulkPriceIncrease')?.value || 0);
        const stockAdd = parseInt(document.getElementById('bulkStockAdd')?.value || 0);
        
        const snapshot = await get(ref(db, 'Catalogs'));
        if (!snapshot.exists()) return;
        
        let updated = 0;
        snapshot.forEach(async (child) => {
            const catalog = child.val();
            const updates = {};
            
            if (priceIncrease !== 0 && catalog.price) {
                updates.price = catalog.price * (1 + priceIncrease / 100);
            }
            if (stockAdd !== 0) {
                const oldStock = catalog.StockQuantity || 0;
                const newStock = oldStock + stockAdd;
                updates.StockQuantity = newStock;
                await logMovement(catalog.CatalogName, oldStock, newStock, 'BULK_UPDATE');
            }
            
            if (Object.keys(updates).length > 0) {
                await update(ref(db, `Catalogs/${child.key}`), updates);
                updated++;
            }
        });
        
        window.showToast(`✅ Updated ${updated} items`, 'success');
        document.getElementById('bulkEditOverlay').remove();
        renderCatalogTablesAccordion();
        updateKPIs();
    } catch (error) {
        console.error('Bulk apply error:', error);
        window.showToast('❌ Error applying changes', 'error');
    }
}

async function bulkDeleteItem(id) {
    if (confirm('Delete this item?')) {
        try {
            const snapshot = await get(ref(db, `Catalogs/${id}`));
            if (snapshot.exists()) {
                const catalog = snapshot.val();
                await remove(ref(db, `Catalogs/${id}`));
                await logAuditEvent('DELETE_ITEM', `Deleted: ${catalog.CatalogName}`, currentUser?.email);
                window.showToast('✅ Item deleted', 'success');
                renderCatalogTablesAccordion();
                updateKPIs();
            }
        } catch (error) {
            window.showToast('❌ Error deleting item', 'error');
        }
    }
}

window.bulkApplyChanges = bulkApplyChanges;
window.bulkDeleteItem = bulkDeleteItem;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    initializeCatalogSelects();
    initTabSwitching();
    initCatalogForm();
    initOrderForm();
    initAuthListeners();
    initSearchFilter();
    updateKPIs();
    setInterval(updateKPIs, 30000); // Update KPIs every 30 seconds
    
    // Wire bulk edit button
    const bulkEditBtn = document.getElementById('bulkEditBtn');
    if (bulkEditBtn) {
        bulkEditBtn.addEventListener('click', openBulkEditModal);
    }

    // Wire dashboard actions
    const dashboardButtons = document.querySelectorAll('.dashboard-action-btn');
    dashboardButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(null, tabName);
        });
    });
    
    // Wire tab click events for audit log and movement history
    document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            if (tab === 'auditLog') {
                setTimeout(renderAuditLog, 100);
            } else if (tab === 'movementHistory') {
                setTimeout(renderMovementHistory, 100);
            } else if (tab === 'manageCatalog') {
                setTimeout(renderDashboard, 100);
            }
        });
    });

    // Initial dashboard load
    updateKPIs();
    renderDashboard();
    initializeSmartNotifications();
});
