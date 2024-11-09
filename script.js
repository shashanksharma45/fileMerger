document.getElementById('uploadFirstFile').addEventListener('change', handleFileUpload);

let firstFileData = [];
let secondFileData = {};
let mergedData = [];
let handleToBankMap = {};
let ifscToBankMap = {};
let originWebsiteMap = {};
let categoryWebsiteMap = {};

async function loadStaticJson() {
    // Load the static JSON file only once
    let secondFile = await fetch('json/secondFile.json');
    secondFileData = await secondFile.json();

    const handleBankFile = await fetch('json/handleBankName.json');
    const handleFileData = await handleBankFile.json();

    const ifscBankFile = await fetch('json/ifscBankName.json');
    const ifscFileData = await ifscBankFile.json();

    const originWebsite = await fetch('json/originWebsite.json');
    const origin = await originWebsite.json();

    const categoryWebsite = await fetch('json/categoryWebsite.json');
    const category = await categoryWebsite.json();

    // Assuming the handles and bank names are in `Sheet1`
    handleFileData.Sheet2.forEach(item => {
        if (item.Handle && item.Bank_name) {
            handleToBankMap[item.Handle.toLowerCase()] = item.Bank_name;
        }
    });

    ifscFileData.Sheet3.forEach(item => {
        if (item.ifsc_code && item.bank_name) {
            ifscToBankMap[item.ifsc_code] = item.bank_name;
        }
    })

    origin.Sheet1.forEach(item => {
        if(item.URL && item.Origin){
            originWebsiteMap[item.URL] = item.Origin;
        }
    })

    category.Sheet1.forEach(item => {
        if(item.URL  && item.Category){
            categoryWebsiteMap[item.URL] = item.Category;
        }
    })

    const sheet1Data = secondFileData.Sheet1; // All objects from Sheet1
    const sheet2Data = handleFileData.sheet2; // All objects from sheet2
    const sheet3Data = ifscFileData.sheet3;
    const sheet4Data = origin.sheet1;
    const sheet5Data = category.sheet1;

    secondFileData = { sheet1Data, sheet2Data, sheet3Data, sheet4Data, sheet5Data};

    return secondFileData;
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    firstFileData = XLSX.utils.sheet_to_json(sheet);
}

function extractDomain(url) {
    try {
        const parsedUrl = new URL(url);
        let domain = parsedUrl.hostname;
        domain = domain.replace(/^www\./, '');
        return domain;  // Extracts the domain (without 'https://' or path)
    } catch (e) {
        return 'Invalid URL';  // In case of invalid URL
    }
}

function determineType(upiVpa) {
    const upiVpaStr = String(upiVpa).trim();
    if (!upiVpaStr) return 'Bank Account';

    // Check if it's a UPI ID (contains @)
    if (upiVpaStr.includes('@')) {
        return 'UPI';
    }

    // Check if it's a phone number (basic check for 10 digits)
    const phonePattern = /^\d{10}$/;
    if (phonePattern.test(upiVpaStr)) {
        return 'Wallet';
    }

    return 'Bank Account'; // If neither, return NA
}

function extractTimestampFromUrl(url) {
    // Extract the number from the URL (after 'npci-')
    const match = url.match(/npci-(\d+)--/);
    if (match && match[1]) {
        return parseInt(match[1], 10);  // Convert the matched number to an integer
    }
    return null; // Return null if no number found
}

function convertTimestampToDate(timestamp) {
    if (timestamp) {
        const date = new Date(0); // Start with Unix epoch (1970-01-01)
        date.setSeconds(timestamp); // Add seconds
        // Adjust for your timezone if needed (e.g., GMT+5:30)
        date.setHours(date.getHours() + 5); // Adjust for hours
        date.setMinutes(date.getMinutes() + 30); // Adjust for minutes
        return date.toISOString().slice(0, 10);
    }
    return 'Invalid Timestamp'; // Return this if the timestamp is not valid
}

function convertToDateTime(npciNumber) {
    if (npciNumber) {
        const date = new Date(0); // Start with Unix epoch (1970-01-01)
        date.setSeconds(npciNumber); // Add seconds
        // Adjust for your timezone if needed (e.g., GMT+5:30)
        date.setHours(date.getHours() + 5); // Adjust for hours
        date.setMinutes(date.getMinutes() + 30); // Adjust for minutes
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } // Convert string to number
}


async function previewData() {
    if (firstFileData.length === 0 || secondFileData.length === 0) {
        alert('Please upload the first file and ensure the JSON file is loaded.');
        return;
    }

    await loadStaticJson();

    // Merge each Excel row with the full JSON row structure
    mergedData = firstFileData.map(excelRow => {
        const npci_mfilterit = [
            excelRow?.mfilteritUrl,
            excelRow?.npciUrl
        ].filter(Boolean).join(',');

        const upiHandle = excelRow?.upiVpa && String(excelRow.upiVpa).includes('@')
            ? String(excelRow.upiVpa).split('@')[1].toLowerCase()
            : 'NA';

        const ifscCode = excelRow?.ifscCode && excelRow.ifscCode !== 'NA'
            ? excelRow.ifscCode.trim().substring(0, 4).toUpperCase()
            : null;

        let bankName = "NA";

        // Prioritize IFSC-based bank lookup if IFSC code exists
        if (ifscCode && ifscToBankMap[ifscCode]) {
            bankName = ifscToBankMap[ifscCode];
        }
        // Fallback to UPI handle-based lookup if no valid IFSC code
        else if (upiHandle && handleToBankMap[upiHandle]) {
            bankName = handleToBankMap[upiHandle];
        }

        const websiteDomain = excelRow?.UPIURLs ? extractDomain(excelRow.UPIURLs) : 'NA';

        const upiType = determineType(excelRow?.upiVpa);

        // Extract the timestamp from the URL and convert it to a date
        const timestamp = extractTimestampFromUrl(excelRow?.npciUrl); // Adjust the column name as needed
        const date = convertTimestampToDate(timestamp)

        const dateTime = convertToDateTime(timestamp);

        const origin = excelRow?.WebsiteURL ? originWebsiteMap[excelRow.WebsiteURL] : 'NA';

        const category = excelRow?.WebsiteURL ? categoryWebsiteMap[excelRow.WebsiteURL] : 'NA';


        return {
            ...secondFileData.sheet1Data[0], // Start with the full JSON structure as the base,
            bank_account_number: excelRow?.BankAccountNumber || secondFileData.sheet1Data[0].bank_account_number,
            ifsc_code: excelRow?.ifscCode || secondFileData.sheet1Data[0].ifsc_code,
            upi_vpa: excelRow?.upiVpa || secondFileData.sheet1Data[0].upi_vpa,
            ac_holder_name: excelRow?.acHolderName || secondFileData.sheet1Data[0].ac_holder_name,
            website_url: excelRow?.WebsiteURL || secondFileData.sheet1Data[0].website_url,
            payment_gateway_intermediate_url: excelRow?.UPIURLs || secondFileData.sheet1Data[0].payment_gateway_intermediate_url,
            payment_gateway_url: excelRow?.UPIURLs || secondFileData.sheet1Data[0].payment_gateway_url,
            upi_url: excelRow?.UPIURLs || secondFileData.sheet1Data[0].upi_url,
            transaction_method: excelRow?.Method || secondFileData.sheet1Data[0].transaction_method,
            screenshot: npci_mfilterit,
            screenshot_case_report_link: npci_mfilterit,
            handle: upiHandle,
            payment_gateway_name: websiteDomain,
            upi_bank_account_wallet: upiType,
            inserted_date: date,
            case_generated_time: dateTime,
            bank_name: bankName,
            origin: origin,
            category_of_website: category
        };
    });

    displayPreview(mergedData);
}


function displayPreview(data) {
    const container = document.getElementById("previewContainer");
    container.innerHTML = "";

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";

    // Generate table headers
    const headerRow = document.createElement("tr");
    Object.keys(data[0]).forEach(column => {
        const th = document.createElement("th");
        th.textContent = column;
        th.style.border = "1px solid black";
        th.style.padding = "8px";
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Populate table rows with data
    data.forEach(row => {
        const rowElement = document.createElement("tr");
        Object.values(row).forEach(cell => {
            const cellElement = document.createElement("td");
            cellElement.textContent = cell || "";  // Show empty if cell is undefined
            cellElement.style.border = "1px solid black";
            cellElement.style.padding = "8px";
            rowElement.appendChild(cellElement);
        });
        table.appendChild(rowElement);
    });

    container.appendChild(table);
}

function downloadUpdatedFile() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(wb, ws, 'MergedData');
    XLSX.writeFile(wb, 'MergedFile.xlsx');

    setTimeout(() => {
        location.reload(); // Reload the page after a slight delay
    }, 500);
}

// Load the static JSON once when the page loads
loadStaticJson();
