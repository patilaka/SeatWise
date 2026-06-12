// Improved by Claude Fable 5 | SeatWise - Main Application Script

// ============================================================
// GLOBAL STATE
// ============================================================
let excelData = [];
let filteredData = [];
let originalFilteredData = [];
const RESULTS_PER_PAGE = 20;
let currentPage = 1;
let totalPages = 1;

// Choices.js instances
let seatChoices;
let branchChoices;
let collegeChoices;
let regionChoices;

// Master branch list (populated after data loads)
let allBranchesList = [];

// ============================================================
// HELPER: Determine college type from institute name
// ============================================================
function getCollegeTypeFromInstitute(name) {
  if (!name) return 'Other';
  const lower = name.toLowerCase();
  if (lower.includes('government') && lower.includes('autonomous'))
    return 'Government-Autonomous';
  if (lower.includes('government')) return 'Government';
  if (lower.includes('autonomous')) return 'Autonomous';
  if (lower.includes('aided')) return 'Aided';
  if (lower.includes('unaided')) return 'Unaided';
  return 'Other';
}

// ============================================================
// REGION MAPPING: Region name → first digit of institute code
// ============================================================
const regionPrefixMap = {
  Amravati: '1',
  Sambhajinagar: '2',
  Mumbai: '3',
  Nagpur: '4',
  Nashik: '5',
  Pune: '6',
};

// ============================================================
// SAFE VALUE EXTRACTION FROM CHOICES.JS
// If "ALL_BRANCHES" is selected for branches, return the full list
// ============================================================
function getSelectedValues(instance, isBranch = false) {
  const selected = instance.getValue(true);
  if (!selected || selected.length === 0) return [];
  if (isBranch && selected.includes('ALL_BRANCHES')) {
    return [...allBranchesList];
  }
  return selected;
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
function showNotification(message, type = 'error') {
  const notif = document.getElementById('notification');
  if (!notif) return;
  const span = notif.querySelector('span');
  if (span) span.textContent = message;
  notif.className = `notification ${type} show`;
  // Auto-dismiss after 5 seconds
  clearTimeout(notif._timeout);
  notif._timeout = setTimeout(() => {
    notif.className = 'notification';
  }, 5000);
}

// ============================================================
// LOADING SPINNER
// ============================================================
function showLoading(show) {
  const existing = document.querySelector('.loading');
  if (show) {
    if (!existing) {
      const div = document.createElement('div');
      div.className = 'loading';
      div.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Loading colleges...';
      document.body.appendChild(div);
    }
  } else {
    if (existing) existing.remove();
  }
}

// ============================================================
// INITIALIZE CHOICES.JS DROPDOWNS
// ============================================================
function initDropdowns() {
  seatChoices = new Choices('#seatType', {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: 'Choose seat types',
    shouldSort: false,
  });

  branchChoices = new Choices('#branch', {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: 'Choose branches',
    searchEnabled: true,
    searchPlaceholderValue: 'Search branches...',
    shouldSort: false,
  });

  collegeChoices = new Choices('#collegeType', {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: 'Choose college types',
    shouldSort: false,
  });

  regionChoices = new Choices('#region', {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: 'Select region(s)',
    shouldSort: false,
  });

  // Populate region dropdown
  regionChoices.setChoices(
    Object.keys(regionPrefixMap).map((r) => ({ value: r, label: r })),
    'value',
    'label',
    true
  );
}

// ============================================================
// POPULATE DROPDOWNS FROM LOADED EXCEL DATA
// ============================================================
function populateDropdowns(data) {
  // Seat types
  const seatTypes = [
    ...new Set(data.map((d) => d['Seat Type']).filter(Boolean)),
  ].sort();
  seatChoices.clearChoices();
  seatChoices.setChoices(
    seatTypes.map((s) => ({ value: s, label: s })),
    'value',
    'label',
    true
  );

  // Branches (with "All Branches" option)
  const branches = [
    ...new Set(data.map((d) => d['Branch']).filter(Boolean)),
  ].sort();
  allBranchesList = [...branches];
  const branchOptions = [
    { value: 'ALL_BRANCHES', label: '✨ All Branches' },
    ...branches.map((b) => ({ value: b, label: b })),
  ];
  branchChoices.clearChoices();
  branchChoices.setChoices(branchOptions, 'value', 'label', true);

  // College types
  const collegeTypes = [
    ...new Set(data.map((d) => getCollegeTypeFromInstitute(d['Institute']))),
  ].sort();
  collegeChoices.clearChoices();
  collegeChoices.setChoices(
    collegeTypes.map((c) => ({ value: c, label: c })),
    'value',
    'label',
    true
  );
}

// ============================================================
// MAIN FILTERING LOGIC
// ============================================================
function filterData() {
  const regions = getSelectedValues(regionChoices);
  const seatTypes = getSelectedValues(seatChoices);
  const branches = getSelectedValues(branchChoices, true);
  const collegeTypes = getSelectedValues(collegeChoices);

  const predictTypeEl = document.querySelector(
    'input[name="predictType"]:checked'
  );
  if (!predictTypeEl) return null;
  const predictType = predictTypeEl.value;

  const inputValue = parseFloat(document.getElementById('inputValue').value);
  const collegeCount = document.getElementById('collegeCount').value;

  // Validation
  if (isNaN(inputValue)) {
    showNotification('Please enter a valid percentile or rank', 'warning');
    return null;
  }
  if (predictType === 'percentile' && (inputValue < 0 || inputValue > 100)) {
    showNotification('Percentile must be between 0 and 100', 'warning');
    return null;
  }
  if (predictType === 'rank' && inputValue < 1) {
    showNotification('Rank must be a positive number', 'warning');
    return null;
  }

  let filtered = [...excelData];

  // Apply filters
  if (seatTypes.length) {
    filtered = filtered.filter((d) => seatTypes.includes(d['Seat Type']));
  }
  if (branches.length) {
    filtered = filtered.filter((d) => branches.includes(d['Branch']));
  }
  if (collegeTypes.length) {
    filtered = filtered.filter((d) =>
      collegeTypes.includes(getCollegeTypeFromInstitute(d['Institute']))
    );
  }

  // Percentile / Rank filter
  if (predictType === 'rank') {
    filtered = filtered.filter(
      (d) => d['Rank'] != null && inputValue <= d['Rank']
    );
  } else {
    filtered = filtered.filter(
      (d) => d['Percentile'] != null && inputValue >= d['Percentile']
    );
  }

  // Region filter (match first digit of institute code)
  if (regions.length) {
    filtered = filtered.filter((d) => {
      const code = String(d['Institute Code'] || '');
      const firstDigit = code.charAt(0);
      return regions.some((region) => regionPrefixMap[region] === firstDigit);
    });
  }

  // Sort by percentile descending (best match first)
  filtered.sort((a, b) => (b['Percentile'] || 0) - (a['Percentile'] || 0));

  // Limit results
  if (collegeCount !== 'all') {
    filtered = filtered.slice(0, parseInt(collegeCount, 10));
  }

  return filtered;
}

// ============================================================
// DISPLAY SELECTED FILTER CRITERIA (Parameter Cards)
// ============================================================
function displaySearchParams() {
  const container = document.getElementById('searchParams');
  if (!container) return;
  container.innerHTML = '';

  const predictTypeEl = document.querySelector(
    'input[name="predictType"]:checked'
  );
  const predictType = predictTypeEl ? predictTypeEl.value : 'percentile';

  const params = [
    {
      icon: 'fa-map-marker-alt',
      label: 'Region',
      value: getSelectedValues(regionChoices).join(', ') || 'All',
    },
    {
      icon: 'fa-chair',
      label: 'Seat Type',
      value: getSelectedValues(seatChoices).join(', ') || 'All',
    },
    {
      icon: 'fa-code-branch',
      label: 'Branch',
      value: getSelectedValues(branchChoices, true).join(', ') || 'All',
    },
    {
      icon: 'fa-university',
      label: 'College Type',
      value: getSelectedValues(collegeChoices).join(', ') || 'All',
    },
    {
      icon: 'fa-filter',
      label: 'Filter By',
      value: predictType === 'percentile' ? 'Percentile' : 'Rank',
    },
    {
      icon: 'fa-calculator',
      label: predictType === 'percentile' ? 'Percentile' : 'Rank',
      value: document.getElementById('inputValue').value,
    },
  ];

  params.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'param-card';
    card.innerHTML = `<h3><i class="fas ${p.icon}"></i> ${p.label}</h3><span>${p.value}</span>`;
    container.appendChild(card);
  });
}

// ============================================================
// RENDER PAGINATED RESULTS TABLE
// ============================================================
function displayResults(page = 1) {
  currentPage = page;
  const start = (page - 1) * RESULTS_PER_PAGE;
  const end = Math.min(start + RESULTS_PER_PAGE, filteredData.length);
  const slice = filteredData.slice(start, end);

  const body = document.getElementById('resultsBody');
  const noResultsMsg = document.getElementById('noResultsMsg');
  const tableContainer = document.querySelector('.results-table-container');
  const paginationEl = document.getElementById('pagination');

  if (!body) return;

  body.innerHTML = '';

  if (filteredData.length === 0) {
    // Show no-results state
    body.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:40px;">No colleges found</td></tr>';
    if (noResultsMsg) noResultsMsg.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    if (paginationEl) paginationEl.innerHTML = '';
    updateResultCounts(0, 0, 0);
    updateStatsInfo();
    return;
  }

  // Hide no-results, show table
  if (noResultsMsg) noResultsMsg.style.display = 'none';
  if (tableContainer) tableContainer.style.display = 'block';

  // Build table rows
  slice.forEach((d) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d['Institute'] || 'N/A'}</td>
      <td>${d['Branch'] || 'N/A'}</td>
      <td>${getCollegeTypeFromInstitute(d['Institute'])}</td>
      <td>${d['Seat Type'] || 'N/A'}</td>
      <td>${d['Rank'] != null ? d['Rank'] : 'N/A'}</td>
      <td>${d['Percentile'] != null ? d['Percentile'] : 'N/A'}</td>
    `;
    body.appendChild(tr);
  });

  // Update counts
  totalPages = Math.ceil(filteredData.length / RESULTS_PER_PAGE);
  updateResultCounts(start + 1, end, filteredData.length);
  updateStatsInfo();

  // Render pagination
  renderPagination();
}

// ============================================================
// UPDATE RESULT COUNT DISPLAY
// ============================================================
function updateResultCounts(startVal, endVal, totalVal) {
  const startEl = document.getElementById('startResult');
  const endEl = document.getElementById('endResult');
  const totalEl = document.getElementById('totalResults');

  if (startEl) startEl.textContent = startVal;
  if (endEl) endEl.textContent = endVal;
  if (totalEl) totalEl.textContent = totalVal;
}

// ============================================================
// UPDATE STATS INFO BAR
// ============================================================
function updateStatsInfo() {
  const statsDiv = document.getElementById('statsInfo');
  if (!statsDiv) return;

  if (filteredData.length === 0) {
    statsDiv.innerHTML =
      '🏛️ No matching colleges found. Try broadening your filters.';
    return;
  }

  const govCount = filteredData.filter((d) =>
    getCollegeTypeFromInstitute(d['Institute']).includes('Government')
  ).length;
  const autonomousCount = filteredData.filter((d) =>
    getCollegeTypeFromInstitute(d['Institute']).includes('Autonomous')
  ).length;

  statsDiv.innerHTML = `
    🏛️ Total: <strong>${filteredData.length}</strong> colleges |
    🏢 Government: <strong>${govCount}</strong> |
    🎓 Autonomous: <strong>${autonomousCount}</strong> |
    🏫 Others: <strong>${filteredData.length - govCount}</strong>
  `;
}

// ============================================================
// BUILD PAGINATION BUTTONS
// ============================================================
function renderPagination() {
  const container = document.getElementById('pagination');
  if (!container) return;
  container.innerHTML = '';

  if (totalPages <= 1) return;

  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '&lsaquo;';
  prevBtn.title = 'Previous page';
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => displayResults(currentPage - 1));
  container.appendChild(prevBtn);

  // Page number buttons (show window of 5)
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.textContent = '1';
    firstBtn.addEventListener('click', () => displayResults(1));
    container.appendChild(firstBtn);
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.cssText =
        'display:flex;align-items:center;padding:0 5px;color:#6c757d;';
      container.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => displayResults(i));
    container.appendChild(btn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.cssText =
        'display:flex;align-items:center;padding:0 5px;color:#6c757d;';
      container.appendChild(dots);
    }
    const lastBtn = document.createElement('button');
    lastBtn.textContent = totalPages;
    lastBtn.addEventListener('click', () => displayResults(totalPages));
    container.appendChild(lastBtn);
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '&rsaquo;';
  nextBtn.title = 'Next page';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => displayResults(currentPage + 1));
  container.appendChild(nextBtn);
}

// ============================================================
// EXPORT RESULTS TO PDF
// ============================================================
function downloadPDF() {
  if (!filteredData.length) {
    showNotification('No data to export', 'info');
    return;
  }

  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    showNotification('PDF library not loaded. Please refresh the page.', 'error');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape' });

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MHT-CET College Predictor Report', 14, 18);

  // Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Colleges: ${filteredData.length}`, 14, 35);

  // Table
  const headers = [
    ['Institute', 'Branch', 'College Type', 'Seat Type', 'Rank', 'Percentile'],
  ];
  const body = filteredData.map((r) => [
    r['Institute'] || 'N/A',
    r['Branch'] || 'N/A',
    getCollegeTypeFromInstitute(r['Institute']),
    r['Seat Type'] || 'N/A',
    r['Rank'] != null ? String(r['Rank']) : 'N/A',
    r['Percentile'] != null ? String(r['Percentile']) : 'N/A',
  ]);

  doc.autoTable({
    startY: 42,
    head: headers,
    body: body,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 112, 128],
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
    },
  });

  doc.save('College_Predictor_Results.pdf');
  showNotification('PDF downloaded successfully!', 'success');
}

// ============================================================
// LIVE SEARCH WITHIN RESULTS
// ============================================================
function performSearch() {
  const searchInput = document.getElementById('searchResults');
  const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!term) {
    filteredData = [...originalFilteredData];
  } else {
    filteredData = originalFilteredData.filter(
      (d) =>
        (d['Institute'] || '').toLowerCase().includes(term) ||
        (d['Branch'] || '').toLowerCase().includes(term) ||
        (d['Seat Type'] || '').toLowerCase().includes(term)
    );
  }

  currentPage = 1;
  displayResults();
}

// ============================================================
// SORT RESULTS
// ============================================================
function sortResults() {
  const sortSelect = document.getElementById('sortSelect');
  if (!sortSelect || !filteredData.length) return;

  const sortMode = sortSelect.value;

  if (sortMode === 'percentile-desc') {
    filteredData.sort((a, b) => (b['Percentile'] || 0) - (a['Percentile'] || 0));
  } else if (sortMode === 'rank-asc') {
    filteredData.sort(
      (a, b) => (a['Rank'] || Infinity) - (b['Rank'] || Infinity)
    );
  }

  originalFilteredData = [...filteredData];
  currentPage = 1;
  displayResults();
}

// ============================================================
// PERSIST FILTER PREFERENCES IN LOCALSTORAGE
// ============================================================
function savePreferences() {
  try {
    const prefs = {
      seat: seatChoices.getValue(true),
      branch: branchChoices.getValue(true),
      college: collegeChoices.getValue(true),
      region: regionChoices.getValue(true),
    };
    localStorage.setItem('seatwise_prefs', JSON.stringify(prefs));
  } catch (e) {
    // localStorage may be full or unavailable
  }
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem('seatwise_prefs');
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs.seat && prefs.seat.length)
      seatChoices.setChoiceByValue(prefs.seat);
    if (prefs.branch && prefs.branch.length)
      branchChoices.setChoiceByValue(prefs.branch);
    if (prefs.college && prefs.college.length)
      collegeChoices.setChoiceByValue(prefs.college);
    if (prefs.region && prefs.region.length)
      regionChoices.setChoiceByValue(prefs.region);
  } catch (e) {
    console.warn('Could not restore preferences:', e);
  }
}

// ============================================================
// RESET ALL FILTERS AND RETURN TO FORM VIEW
// ============================================================
function resetForm() {
  // Reset form fields
  const form = document.getElementById('predictorForm');
  if (form) form.reset();

  const inputValue = document.getElementById('inputValue');
  if (inputValue) inputValue.value = '';

  const percentileRadio = document.querySelector(
    'input[name="predictType"][value="percentile"]'
  );
  if (percentileRadio) percentileRadio.checked = true;

  // Reset label
  const inputLabel = document.getElementById('inputLabel');
  if (inputLabel) {
    inputLabel.innerHTML =
      '<i class="fas fa-calculator"></i> Enter Percentile:';
  }

  // Reset Choices.js dropdowns
  if (seatChoices) seatChoices.clearStore();
  if (branchChoices) branchChoices.clearStore();
  if (collegeChoices) collegeChoices.clearStore();
  if (regionChoices) regionChoices.clearStore();

  // Repopulate
  populateDropdowns(excelData);

  // Switch views
  const formCard = document.getElementById('formCard');
  const resultsContainer = document.getElementById('resultsContainer');
  if (formCard) formCard.style.display = 'block';
  if (resultsContainer) resultsContainer.style.display = 'none';

  // Clear search
  const searchInput = document.getElementById('searchResults');
  if (searchInput) searchInput.value = '';

  // Reset data arrays
  originalFilteredData = [];
  filteredData = [];

  savePreferences();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// INITIALIZATION
// ============================================================
async function initApp() {
  // Guard: wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
    return;
  }

  initDropdowns();
  showLoading(true);

  try {
    // Fetch college data
    const res = await fetch('Engineering-College-List.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const json = await res.json();
    excelData = json['MHT-CET College Data'] || [];

    if (!excelData.length) {
      throw new Error('Dataset is empty. Please check the JSON file.');
    }

    populateDropdowns(excelData);
    loadPreferences();
    showLoading(false);
  } catch (err) {
    console.error('Data load error:', err);
    showLoading(false);
    showNotification(
      `Failed to load college data: ${err.message}. Please ensure the JSON file exists.`,
      'error'
    );
    return;
  }

  // ==========================================================
  // ATTACH EVENT LISTENERS
  // ==========================================================

  // Predict button
  const predictBtn = document.getElementById('predictButton');
  if (predictBtn) {
    predictBtn.addEventListener('click', () => {
      const filtered = filterData();
      if (filtered === null) return; // validation failed

      if (filtered && filtered.length > 0) {
        filteredData = filtered;
        originalFilteredData = [...filteredData];

        const formCard = document.getElementById('formCard');
        const resultsContainer = document.getElementById('resultsContainer');

        if (formCard) formCard.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'block';

        displaySearchParams();
        displayResults();
        savePreferences();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showNotification(
          'No colleges found matching your criteria. Try broadening your filters.',
          'info'
        );
      }
    });
  }

  // Reset / New Search button
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetForm);
  }

  // Download PDF button
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadPDF);
  }

  // Clear search button
  const clearSearchBtn = document.getElementById('clearSearch');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      const searchInput = document.getElementById('searchResults');
      if (searchInput) searchInput.value = '';
      performSearch();
    });
  }

  // Search input (live filtering)
  const searchInput = document.getElementById('searchResults');
  if (searchInput) {
    searchInput.addEventListener('input', performSearch);
  }

  // Sort dropdown
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', sortResults);
  }

  // Radio buttons: update label text
  const radioButtons = document.querySelectorAll('input[name="predictType"]');
  radioButtons.forEach((input) => {
    input.addEventListener('change', function () {
      const inputLabel = document.getElementById('inputLabel');
      if (inputLabel) {
        inputLabel.innerHTML =
          this.value === 'percentile'
            ? '<i class="fas fa-calculator"></i> Enter Percentile:'
            : '<i class="fas fa-calculator"></i> Enter Rank:';
      }
      // Update min attribute on input
      const inputValue = document.getElementById('inputValue');
      if (inputValue) {
        inputValue.min = this.value === 'percentile' ? '0' : '1';
        inputValue.max = this.value === 'percentile' ? '100' : '';
        inputValue.placeholder =
          this.value === 'percentile'
            ? 'Enter your percentile (0-100)'
            : 'Enter your rank';
      }
    });
  });

  // Keyboard shortcut: Enter key on input field triggers prediction
  const inputValue = document.getElementById('inputValue');
  if (inputValue) {
    inputValue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (predictBtn) predictBtn.click();
      }
    });
  }

  console.log(
    '%c🚀 SeatWise %cReady',
    'font-size:18px;font-weight:bold;color:#4361ee;',
    'font-size:14px;color:#333;'
  );
  console.log(
    '%cMHT-CET College Predictor %c| Developed by Shreyas Pawar',
    'color:#666;',
    'color:#888;'
  );
}

// ============================================================
// BOOTSTRAP
// ============================================================
initApp();
