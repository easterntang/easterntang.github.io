// ==================== 配置区（请修改为你的 LeanCloud 信息）====================
// 1. LeanCloud 初始化配置
AV.init({
    appId: "awjrq2pnF6yDBX2QT7Sq1dHQ-gzGzoHsz",
    appKey: "WY6uq9q4hPthkwKX5JIHrlYk",
    serverURL: "https://awjrq2pn.lc-cn-n1-shared.com" // 或默认地址：https://AVOSCloud.com
});
// 2. 自定义房间 ID（确保与抽奖系统的 ROOM_ID 不同）
const ROOM_ID = "file_submit_system_room_001";
// 3. 房主默认密码
const DEFAULT_OWNER_PASSWORD = "admin123";
// ================================== 配置结束 ==================================

// ==================== LeanCloud 数据模型定义 ====================
const Submitter = AV.Object.extend('Submitter');
const SystemStatus = AV.Object.extend('SystemStatus');

// ==================== 页面切换函数 ====================
function showElement(id) {
    document.querySelectorAll('[id$="-selection"], [id$="-login"], [id$="-dashboard"], [id$="-verify"], [id$="-submit"]').forEach(el => {
        el.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    // 切换页面时更新系统状态显示
    updateSystemStatusDisplay();
    // 房主页面需要更新数据
    if (id === 'house-owner-dashboard') {
        updateHouseOwnerDashboard();
    }
    // 访客验证页面检查系统状态
    if (id === 'visitor-verify') {
        checkVisitorSystemStatus();
    }
}

function enterHouseOwnerMode() {
    showElement('house-owner-login');
}

function enterVisitorMode() {
    showElement('visitor-verify');
}

function backToRoleSelection() {
    showElement('role-selection');
}

function backToVisitorVerify() {
    showElement('visitor-verify');
    document.getElementById('file-upload').value = '';
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('submit-file-btn').disabled = true;
}

// ==================== 系统状态管理（LeanCloud 版） ====================
// 获取当前房间的系统状态
async function getSystemStatus() {
    try {
        const query = new AV.Query('SystemStatus');
        query.equalTo('roomId', ROOM_ID);
        let statusObj = await query.first();
        
        // 若不存在，创建默认状态（未开始）
        if (!statusObj) {
            statusObj = new SystemStatus();
            statusObj.set('roomId', ROOM_ID);
            statusObj.set('status', 'not_started');
            await statusObj.save();
        }
        return statusObj.get('status');
    } catch (error) {
        alert('获取系统状态失败：' + error.message);
        return 'not_started';
    }
}

// 更新系统状态
async function updateSystemStatus(newStatus) {
    try {
        const query = new AV.Query('SystemStatus');
        query.equalTo('roomId', ROOM_ID);
        let statusObj = await query.first();
        
        if (!statusObj) {
            statusObj = new SystemStatus();
            statusObj.set('roomId', ROOM_ID);
        }
        statusObj.set('status', newStatus);
        await statusObj.save();
        
        updateSystemStatusDisplay();
        return true;
    } catch (error) {
        alert('更新系统状态失败：' + error.message);
        return false;
    }
}

// 更新系统状态显示
async function updateSystemStatusDisplay() {
    const systemStatus = await getSystemStatus();
    const statusTextMap = {
        'not_started': { text: '未开始', class: 'bg-gray-200 text-gray-700' },
        'running': { text: '运行中', class: 'bg-success text-white' },
        'paused': { text: '已暂停', class: 'bg-warning text-white' },
        'ended': { text: '已结束', class: 'bg-danger text-white' }
    };
    const statusConfig = statusTextMap[systemStatus] || statusTextMap.not_started;

    // 更新房主页面状态
    if (document.getElementById('system-status-badge')) {
        document.getElementById('system-status-badge').textContent = statusConfig.text;
        document.getElementById('system-status-badge').className = `status-badge ${statusConfig.class}`;
        
        // 控制房主按钮显示
        document.getElementById('btn-start-system').classList.add('hidden');
        document.getElementById('btn-pause-system').classList.add('hidden');
        document.getElementById('btn-resume-system').classList.add('hidden');
        document.getElementById('btn-end-system').classList.add('hidden');

        if (systemStatus === 'not_started') {
            document.getElementById('btn-start-system').classList.remove('hidden');
        } else if (systemStatus === 'running') {
            document.getElementById('btn-pause-system').classList.remove('hidden');
            document.getElementById('btn-end-system').classList.remove('hidden');
        } else if (systemStatus === 'paused') {
            document.getElementById('btn-resume-system').classList.remove('hidden');
            document.getElementById('btn-end-system').classList.remove('hidden');
        }
    }

    // 更新访客页面状态
    if (document.getElementById('visitor-system-status')) {
        document.getElementById('visitor-system-status').classList.remove('hidden');
        document.getElementById('visitor-status-badge').textContent = statusConfig.text;
        document.getElementById('visitor-status-badge').className = `status-badge ${statusConfig.class}`;
    }

    if (document.getElementById('visitor-verify-status')) {
        document.getElementById('visitor-verify-status').classList.remove('hidden');
        const verifyBadge = document.createElement('span');
        verifyBadge.textContent = statusConfig.text;
        verifyBadge.className = `status-badge ${statusConfig.class}`;
        document.getElementById('visitor-verify-status').innerHTML = '';
        document.getElementById('visitor-verify-status').appendChild(verifyBadge);
    }

    if (document.getElementById('visitor-submit-status')) {
        document.getElementById('visitor-submit-status').classList.remove('hidden');
        const submitBadge = document.createElement('span');
        submitBadge.textContent = statusConfig.text;
        submitBadge.className = `status-badge ${statusConfig.class}`;
        document.getElementById('visitor-submit-status').innerHTML = '';
        document.getElementById('visitor-submit-status').appendChild(submitBadge);
    }
}

// 检查访客系统状态权限
async function checkVisitorSystemStatus() {
    const systemStatus = await getSystemStatus();
    const statusError = document.getElementById('system-status-error');
    const verifyBtn = document.querySelector('#visitor-verify button:first-of-type');
    
    if (systemStatus !== 'running') {
        if (statusError) {
            statusError.textContent = `系统当前${systemStatus === 'not_started' ? '未开始' : systemStatus === 'paused' ? '已暂停' : '已结束'}，暂不允许提交操作`;
            statusError.classList.remove('hidden');
        }
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
            verifyBtn.classList.remove('bg-primary', 'hover:bg-primary/90');
        }
    } else {
        if (statusError) {
            statusError.classList.add('hidden');
        }
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
            verifyBtn.classList.add('bg-primary', 'hover:bg-primary/90');
        }
    }
}

// 房主系统状态操作
async function startSystem() {
    if (confirm('确定要开始提交系统吗？开始后访客将可以提交文件')) {
        const success = await updateSystemStatus('running');
        if (success) {
            alert('提交系统已开始，访客现在可以进行提交操作');
        }
    }
}

async function pauseSystem() {
    if (confirm('确定要暂停提交系统吗？暂停后访客将无法提交文件')) {
        const success = await updateSystemStatus('paused');
        if (success) {
            alert('提交系统已暂停，访客暂时无法进行提交操作');
        }
    }
}

async function resumeSystem() {
    if (confirm('确定要恢复提交系统吗？恢复后访客将可以继续提交文件')) {
        const success = await updateSystemStatus('running');
        if (success) {
            alert('提交系统已恢复，访客现在可以继续提交操作');
        }
    }
}

async function endSystem() {
    if (confirm('确定要结束提交系统吗？结束后将无法恢复，访客永久无法提交文件')) {
        const success = await updateSystemStatus('ended');
        if (success) {
            alert('提交系统已结束，访客将无法再进行提交操作');
        }
    }
}

// ==================== 房主密码验证 ====================
function verifyHouseOwnerPassword() {
    const inputPassword = document.getElementById('owner-password').value;
    const errorElement = document.getElementById('password-error');

    if (inputPassword === DEFAULT_OWNER_PASSWORD) {
        errorElement.classList.add('hidden');
        showElement('house-owner-dashboard');
    } else {
        errorElement.classList.remove('hidden');
    }
}

// ==================== 提交人名单管理（LeanCloud 版） ====================
// 添加提交人
async function addSubmitter() {
    const nameInput = document.getElementById('add-name');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        // 检查是否已存在
        const query = new AV.Query('Submitter');
        query.equalTo('roomId', ROOM_ID);
        query.equalTo('name', name);
        const exists = await query.find();
        
        if (exists.length > 0) {
            alert('该姓名已存在！');
            return;
        }

        // 创建新提交人
        const submitter = new Submitter();
        submitter.set('roomId', ROOM_ID);
        submitter.set('name', name);
        submitter.set('submitted', false);
        submitter.set('fileUrl', '');
        submitter.set('fileName', '');
        submitter.set('fileType', '');
        submitter.set('submitTime', '');
        
        await submitter.save();
        nameInput.value = '';
        await updateHouseOwnerDashboard(); // 刷新数据
    } catch (error) {
        alert('添加提交人失败：' + error.message);
    }
}

// 导入提交人名单
async function importSubmitterList() {
    const fileInput = document.getElementById('import-list');
    const file = fileInput.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    let names = [];

    // 处理 Excel 文件
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 提取姓名
                names = jsonData.map(row => {
                    if (row.length > 0 && row[0] !== null && row[0] !== undefined) {
                        return String(row[0]).trim();
                    }
                    return '';
                }).filter(name => name);

                await processImportedNames(names, fileInput);
            } catch (error) {
                alert('Excel文件解析失败：' + error.message);
                fileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    // 处理 TXT/CSV 文件
    else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const content = e.target.result;
            if (fileName.endsWith('.txt')) {
                names = content.split('\n').map(name => name.trim()).filter(name => name);
            } else if (fileName.endsWith('.csv')) {
                names = content.split('\n').map(line => {
                    const columns = line.split(',').map(col => col.trim());
                    return columns[0];
                }).filter(name => name);
            }
            await processImportedNames(names, fileInput);
        };
        reader.readAsText(file);
    } else {
        alert('仅支持 .txt/.csv/.xlsx/.xls 格式文件！');
        fileInput.value = '';
    }
}

// 处理导入的姓名列表
async function processImportedNames(names, fileInput) {
    if (names.length === 0) {
        alert('导入文件无有效姓名！');
        fileInput.value = '';
        return;
    }

    try {
        // 批量检查已存在的姓名
        const query = new AV.Query('Submitter');
        query.equalTo('roomId', ROOM_ID);
        query.containedIn('name', names);
        const existingSubmitters = await query.find();
        const existingNames = existingSubmitters.map(item => item.get('name'));

        // 批量创建新提交人
        const newSubmitters = names.filter(name => !existingNames.includes(name)).map(name => {
            const submitter = new Submitter();
            submitter.set('roomId', ROOM_ID);
            submitter.set('name', name);
            submitter.set('submitted', false);
            submitter.set('fileUrl', '');
            submitter.set('fileName', '');
            submitter.set('fileType', '');
            submitter.set('submitTime', '');
            return submitter;
        });

        // 批量保存
        if (newSubmitters.length > 0) {
            await AV.Object.saveAll(newSubmitters);
        }

        fileInput.value = '';
        await updateHouseOwnerDashboard();
        alert(`成功导入 ${newSubmitters.length} 个新姓名（总计识别 ${names.length} 个姓名，${names.length - newSubmitters.length} 个已存在）！`);
    } catch (error) {
        alert('导入名单失败：' + error.message);
    }
}

// 删除提交人
async function deleteSubmitter(objectId) {
    if (!confirm('确定要删除该提交人吗？')) return;

    try {
        const submitter = AV.Object.createWithoutData('Submitter', objectId);
        await submitter.destroy();
        await updateHouseOwnerDashboard();
    } catch (error) {
        alert('删除提交人失败：' + error.message);
    }
}

// 更新房主仪表盘数据
async function updateHouseOwnerDashboard() {
    try {
        // 查询当前房间的所有提交人
        const query = new AV.Query('Submitter');
        query.equalTo('roomId', ROOM_ID);
        const submitterList = await query.find();
        
        const totalCount = submitterList.length;
        const submittedCount = submitterList.filter(item => item.get('submitted')).length;
        const unsubmittedCount = totalCount - submittedCount;

        // 更新统计数字
        document.getElementById('total-count').textContent = totalCount;
        document.getElementById('submitted-count').textContent = submittedCount;
        document.getElementById('unsubmitted-count').textContent = unsubmittedCount;

        // 更新名单列表
        const listContainer = document.getElementById('submitter-list-container');
        if (totalCount === 0) {
            listContainer.innerHTML = `
                <div class="grid grid-cols-12 py-3 px-4 border-b border-gray-100 text-center items-center">
                    <div class="col-span-12 text-gray-500">暂无名单，请添加或导入</div>
                </div>
            `;
        } else {
            listContainer.innerHTML = '';
            submitterList.forEach(item => {
                const statusClass = item.get('submitted') ? 'text-success' : 'text-warning';
                const statusText = item.get('submitted') ? '已提交' : '未提交';
                listContainer.innerHTML += `
                    <div class="grid grid-cols-12 py-3 px-4 border-b border-gray-100 items-center">
                        <div class="col-span-6 text-left pl-4">${item.get('name')}</div>
                        <div class="col-span-3 text-center ${statusClass}">${statusText}</div>
                        <div class="col-span-3 text-center">
                            <button onclick="deleteSubmitter('${item.id}')" class="text-danger text-sm hover:underline">
                                <i class="fa fa-trash mr-1"></i> 删除
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        // 更新提交记录
        const recordsContainer = document.getElementById('submission-records-container');
        const submittedList = submitterList.filter(item => item.get('submitted'));
        
        if (submittedList.length === 0) {
            recordsContainer.innerHTML = `
                <div class="grid grid-cols-12 py-3 px-4 border-b border-gray-100 text-center items-center">
                    <div class="col-span-12 text-gray-500">暂无提交记录</div>
                </div>
            `;
        } else {
            recordsContainer.innerHTML = '';
            submittedList.forEach(item => {
                recordsContainer.innerHTML += `
                    <div class="grid grid-cols-12 py-3 px-4 border-b border-gray-100 items-center">
                        <div class="col-span-4 text-center">${item.get('name')}</div>
                        <div class="col-span-5 text-center truncate" title="${item.get('fileName')}">${item.get('fileName')}</div>
                        <div class="col-span-3 text-center text-sm text-gray-500">${item.get('submitTime') || '未知时间'}</div>
                    </div>
                `;
            });
        }
    } catch (error) {
        alert('更新仪表盘数据失败：' + error.message);
    }
}

// ==================== 访客操作（LeanCloud 版） ====================
// 访客姓名验证
async function verifyVisitorName() {
    // 检查系统状态
    const systemStatus = await getSystemStatus();
    if (systemStatus !== 'running') {
        await checkVisitorSystemStatus();
        return;
    }

    const inputName = document.getElementById('visitor-name').value.trim();
    const errorElement = document.getElementById('name-error');

    try {
        // 查询姓名是否存在
        const query = new AV.Query('Submitter');
        query.equalTo('roomId', ROOM_ID);
        query.equalTo('name', inputName);
        const submitter = await query.first();

        if (submitter) {
            errorElement.classList.add('hidden');
            // 存储当前访客信息
            localStorage.setItem('currentVisitor', JSON.stringify({
                name: inputName,
                objectId: submitter.id
            }));
            showElement('visitor-submit');
            document.getElementById('visitor-name-display').textContent = `当前用户：${inputName}`;
            
            // 检查是否已有提交
            if (submitter.get('submitted') && submitter.get('fileUrl')) {
                displayFilePreview(submitter.get('fileUrl'), submitter.get('fileName'), submitter.get('fileType'));
                document.getElementById('submit-file-btn').textContent = '重新提交';
            }
        } else {
            errorElement.classList.remove('hidden');
        }
    } catch (error) {
        alert('验证姓名失败：' + error.message);
    }
}

// 处理文件选择
async function handleFileSelect() {
    // 检查系统状态
    const systemStatus = await getSystemStatus();
    if (systemStatus !== 'running') {
        alert(`系统当前${systemStatus === 'not_started' ? '未开始' : systemStatus === 'paused' ? '已暂停' : '已结束'}，暂不允许上传文件`);
        return;
    }

    const fileInput = document.getElementById('file-upload');
    const file = fileInput.files[0];
    if (!file) return;

    // 限制文件大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('文件大小超过5MB限制，请选择更小的文件！');
        fileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileUrl = e.target.result;
        displayFilePreview(fileUrl, file.name, file.type);
        document.getElementById('submit-file-btn').disabled = false;
    };
    reader.readAsDataURL(file);
}

// 显示文件预览
function displayFilePreview(fileUrl, fileName, fileType) {
    const previewContainer = document.getElementById('file-preview');
    const previewContent = document.getElementById('preview-content');
    previewContainer.classList.remove('hidden');

    if (fileType.startsWith('image/')) {
        previewContent.innerHTML = `
            <img src="${fileUrl}" alt="${fileName}" class="max-w-full max-h-[300px] mx-auto">
            <p class="mt-2 text-center text-gray-700">${fileName}</p>
        `;
    } else {
        previewContent.innerHTML = `
            <div class="text-center">
                <i class="fa fa-file-text-o text-5xl text-gray-400 mb-2"></i>
                <p class="text-gray-700">${fileName}</p>
                <p class="text-sm text-gray-500">无法预览该文件类型，将直接提交</p>
            </div>
        `;
    }
}

// 提交文件
async function submitFile() {
    // 检查系统状态
    const systemStatus = await getSystemStatus();
    if (systemStatus !== 'running') {
        alert(`系统当前${systemStatus === 'not_started' ? '未开始' : systemStatus === 'paused' ? '已暂停' : '已结束'}，暂不允许提交文件`);
        return;
    }

    const currentVisitorStr = localStorage.getItem('currentVisitor');
    if (!currentVisitorStr) {
        alert('请先验证身份！');
        backToVisitorVerify();
        return;
    }

    const currentVisitor = JSON.parse(currentVisitorStr);
    const fileInput = document.getElementById('file-upload');
    const file = fileInput.files[0];
    if (!file) return;

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                // 更新提交人信息
                const submitter = AV.Object.createWithoutData('Submitter', currentVisitor.objectId);
                submitter.set('submitted', true);
                submitter.set('fileUrl', e.target.result);
                submitter.set('fileName', file.name);
                submitter.set('fileType', file.type);
                submitter.set('submitTime', new Date().toLocaleString());
                
                await submitter.save();

                // 显示提交成功提示
                const statusElement = document.getElementById('submit-status');
                statusElement.className = 'mt-4 text-center text-success font-medium';
                statusElement.textContent = '提交成功！';
                statusElement.classList.remove('hidden');

                // 3秒后重置
                setTimeout(() => {
                    statusElement.classList.add('hidden');
                    backToVisitorVerify();
                }, 3000);
            } catch (error) {
                alert('提交文件失败：' + error.message);
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        alert('处理文件失败：' + error.message);
    }
}

// ==================== 文件打包导出 ====================
async function exportAllSubmittedFiles() {
    try {
        // 查询已提交的文件
        const query = new AV.Query('Submitter');
        query.equalTo('roomId', ROOM_ID);
        query.equalTo('submitted', true);
        query.exists('fileUrl');
        const submittedFiles = await query.find();

        if (submittedFiles.length === 0) {
            alert('暂无已提交的文件，无法导出！');
            return;
        }

        const zip = new JSZip();
        let processedCount = 0;

        // 处理每个文件
        submittedFiles.forEach(async (item) => {
            try {
                const fileUrl = item.get('fileUrl');
                const fileName = item.get('fileName');
                const name = item.get('name');
                
                // 转换为Blob
                const blob = await dataURLToBlob(fileUrl);
                // 构造文件名
                const zipFileName = `${name}_${fileName}`;
                zip.file(zipFileName, blob);
                
                processedCount++;
                if (processedCount === submittedFiles.length) {
                    await generateAndDownloadZip(zip, submittedFiles.length);
                }
            } catch (error) {
                console.error(`处理 ${item.get('name')} 的文件失败：`, error);
                alert(`处理 ${item.get('name')} 的文件时出错，将跳过该文件`);
                processedCount++;
                
                if (processedCount === submittedFiles.length) {
                    await generateAndDownloadZip(zip, zip.files.length);
                }
            }
        });
    } catch (error) {
        alert('获取提交文件失败：' + error.message);
    }
}

// dataURL 转 Blob
function dataURLToBlob(dataURL) {
    return new Promise((resolve, reject) => {
        try {
            const arr = dataURL.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            if (!mimeMatch) {
                reject(new Error('无效的文件格式'));
                return;
            }
            const mime = mimeMatch[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);

            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }

            resolve(new Blob([u8arr], { type: mime }));
        } catch (error) {
            reject(error);
        }
    });
}

// 生成并下载 ZIP
function generateAndDownloadZip(zip, successCount) {
    return new Promise((resolve, reject) => {
        zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        })
        .then(content => {
            const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
            const zipFileName = `提交文件汇总_${dateStr}.zip`;
            saveAs(content, zipFileName);
            alert(`成功导出 ${successCount} 个文件！`);
            resolve();
        })
        .catch(error => {
            alert('文件打包失败：' + error.message);
            reject(error);
        });
    });
}

// ==================== 拖拽上传处理 ====================
const uploadArea = document.getElementById('upload-area');
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('border-primary');
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('border-primary');
});
uploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('border-primary');
    
    // 检查系统状态
    const systemStatus = await getSystemStatus();
    if (systemStatus !== 'running') {
        alert(`系统当前${systemStatus === 'not_started' ? '未开始' : systemStatus === 'paused' ? '已暂停' : '已结束'}，暂不允许上传文件`);
        return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        document.getElementById('file-upload').files = files;
        handleFileSelect();
    }
});

// ==================== 页面初始化 ====================
window.onload = async function() {
    await updateSystemStatusDisplay();
};
