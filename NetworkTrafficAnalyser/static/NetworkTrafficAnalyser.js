let globalPacketData = [];
const blockedIPs = new Set();

function renderPackets(data) {
  const tableBody = document.getElementById('packet-table');
  tableBody.innerHTML = '';

  data.slice().reverse().forEach(packet => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${packet.time}</td>
      <td>${packet.src}</td>
      <td>${packet.src_port || '-'}</td>
      <td>${packet.dst}</td>
      <td>${packet.dst_port || '-'}</td>
      <td>${packet.proto}</td>
    `;
    tableBody.appendChild(row);
  });
}

function fetchPackets() {
  fetch('/api/packets')
    .then(response => response.json())
    .then(data => {
      globalPacketData = data.filter(pkt => 
        !blockedIPs.has(pkt.src) && !blockedIPs.has(pkt.dst)
      );

      const filteredData = applyFilters(globalPacketData);
      renderPackets(filteredData);
    })
    .catch(error => console.error('Error fetching packets:', error));
}


document.getElementById('protocolFilter').addEventListener('input', fetchPackets);
document.getElementById('srcFilter').addEventListener('input', fetchPackets);
document.getElementById('dstFilter').addEventListener('input', fetchPackets);
document.getElementById('srcPortFilter').addEventListener('input', fetchPackets);
document.getElementById('dstPortFilter').addEventListener('input', fetchPackets);

['exactTime', 'startTime', 'endTime'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const filtered = applyFilters(globalPacketData);
    renderPackets(filtered);
  });
});

const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const restartBtn = document.getElementById('restart-btn');

function clearControlStates() {
  playBtn.classList.remove('active-play');
  pauseBtn.classList.remove('active-pause');
  stopBtn.classList.remove('active-stop');
}

function updatePacketCount() {
  fetch('/api/packet_count')
    .then(response => response.json())
    .then(data => {
      document.getElementById('packet-count').textContent = data.total;
    })
    .catch(error => console.error('Error fetching packet count:', error));
}
let timeLabels = [];
let packetCounts = [];
let protocolCounts = { TCP: 0, UDP: 0, ICMP: 0 };
let protocolHistory = {};

let dynamicProtocolCounts = {};

const protocolCtx = document.getElementById('protocolChart').getContext('2d');
const protocolChart = new Chart(protocolCtx, {
  type: 'bar',
  data: {
    labels: [],
    datasets: [{
      label: 'Protocol Count',
      data: [],
      backgroundColor: [],
    }]
  },
  options: {
    scales: {
      x: { ticks: { color: '#ccc' } },
      y: { ticks: { color: '#ccc' }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});

let tcpCounts = [];
let udpCounts = [];
let icmpCounts = [];

const protocolOverTimeCtx = document.getElementById('protocolOverTimeChart').getContext('2d');

const protocolOverTimeChart = new Chart(protocolOverTimeCtx, {
  type: 'line',
  data: {
    labels: timeLabels,
    datasets: []
  },
  options: {
    scales: {
      x: { ticks: { color: '#ccc' } },
      y: { ticks: { color: '#ccc' }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});

const commonPortsCtx = document.getElementById('commonPortsChart').getContext('2d');

const commonPortsChart = new Chart(commonPortsCtx, {
  type: 'bar',
  data: {
    labels: [],
    datasets: [{
      label: 'Most Common Ports',
      data: [],
      backgroundColor: '#8e44ad'
    }]
  },
  options: {
    scales: {
      x: {
        ticks: { color: '#ccc' },
        title: { display: true, text: 'Port', color: '#ccc' }
      },
      y: {
        ticks: { color: '#ccc' },
        title: { display: true, text: 'Count', color: '#ccc' },
        beginAtZero: true
      }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});

document.getElementById('export-charts-btn').addEventListener('click', () => {
  const chart1 = document.getElementById('protocolChart');
  const chart2 = document.getElementById('protocolOverTimeChart');
  const chart3 = document.getElementById('commonPortsChart');

  const width = Math.max(chart1.width, chart2.width, chart3.width);
  const height = chart1.height + chart2.height + chart3.height;

  const combinedCanvas = document.createElement('canvas');
  combinedCanvas.width = width;
  combinedCanvas.height = height;

  const ctx = combinedCanvas.getContext('2d');

  ctx.drawImage(chart1, 0, 0);
  ctx.drawImage(chart2, 0, chart1.height);
  ctx.drawImage(chart3, 0, chart1.height + chart2.height);
  const link = document.createElement('a');
  link.download = 'combined_charts.png';
  link.href = combinedCanvas.toDataURL('image/png');
  link.click();
});

let monitoring = true;
let intervalId = null;

pauseBtn.addEventListener('click', () => {
  clearControlStates();
  pauseBtn.classList.add('active-pause');
  clearInterval(intervalId);
  intervalId = null;
  monitoring = false;
  fetch('/api/pause_monitoring', { method: 'POST' });
});

playBtn.addEventListener('click', () => {
  clearControlStates();
  playBtn.classList.add('active-play');
  if (!intervalId) {
    fetch('/api/start_monitoring', { method: 'POST' })
      .then(() => {
        intervalId = setInterval(updateChartsAndPackets, 2000);
        monitoring = true;
      });
  }
});

stopBtn.addEventListener('click', () => {
  clearControlStates();
  stopBtn.classList.add('active-stop');
  clearInterval(intervalId);
  intervalId = null;
  monitoring = false;

  timeLabels.length = 0;
  packetCounts.length = 0;
  protocolHistory = {};
  protocolChart.data.labels = [];
  protocolChart.data.datasets[0].data = [];
  protocolOverTimeChart.data.datasets = [];
  packetChart.update();
  protocolChart.update();
  protocolOverTimeChart.update();
});

restartBtn.addEventListener('click', () => {
  clearInterval(intervalId);
  intervalId = null;

  timeLabels.length = 0;
  packetCounts.length = 0;
  protocolHistory = {};
  protocolChart.data.labels = [];
  protocolChart.data.datasets[0].data = [];
  protocolOverTimeChart.data.datasets = [];
  document.getElementById('packet-table').innerHTML = '';
  document.getElementById('protocolFilter').value = '';
  document.getElementById('srcFilter').value = '';
  document.getElementById('dstFilter').value = '';
  packetChart.update();
  protocolChart.update();
  protocolOverTimeChart.update();

  fetch('/api/reset', { method: 'POST' })
    .then(() => {
      return fetch('/api/start_monitoring', { method: 'POST' });
    })
    .then(() => {
      updatePacketCount();
      intervalId = setInterval(updateChartsAndPackets, 2000);
    })
    .catch(err => console.error('Error during restart process:', err));
}); 

function applyFilters(data) {
  const protocol = document.getElementById('protocolFilter').value.toLowerCase();
  const src = document.getElementById('srcFilter').value;
  const dst = document.getElementById('dstFilter').value;
  const srcPort = document.getElementById('srcPortFilter').value;
  const dstPort = document.getElementById('dstPortFilter').value;
  const exactTime = document.getElementById('exactTime').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;

  const startTimeWithSeconds = startTime ? startTime + ':00' : null;
  const endTimeWithSeconds = endTime ? endTime + ':00' : null;

  return data.filter(packet => {
    const packetTime = packet.time || '';

    const matchesStartTime = !startTimeWithSeconds || packetTime >= startTimeWithSeconds;
    const matchesEndTime = !endTimeWithSeconds || packetTime <= endTimeWithSeconds;
    const matchesProtocol = !protocol || (packet.proto && packet.proto.toLowerCase().includes(protocol));
    const matchesSrc = !src || packet.src.includes(src);
    const matchesDst = !dst || packet.dst.includes(dst);
    const matchesSrcPort = !srcPort || packet.src_port === Number(srcPort);
    const matchesDstPort = !dstPort || packet.dst_port === Number(dstPort);


    console.log({
  packetSrcPort: packet.src_port,
  packetDstPort: packet.dst_port,
  filterSrcPort: srcPort,
  filterDstPort: dstPort
});

    if (exactTime) {
      return packetTime === exactTime;
    }

    return matchesStartTime && matchesEndTime && matchesProtocol &&
           matchesSrc && matchesDst && matchesSrcPort && matchesDstPort;
  });
}

const portColors = {}; 

function updateChartsAndPackets() {
  fetchPackets();
  updatePacketCount();

  fetch('/api/packets')
    .then(res => res.json())
    .then(data => {
      globalPacketData = data;
      dynamicProtocolCounts = {};

      data.forEach(pkt => {
        const proto = pkt.proto.toUpperCase();
        if (!dynamicProtocolCounts[proto]) {
          dynamicProtocolCounts[proto] = 0;
        }
        dynamicProtocolCounts[proto]++;
      });

      const dynamicProtocols = Object.keys(dynamicProtocolCounts);
      const dynamicCounts = Object.values(dynamicProtocolCounts);
      const dynamicColors = dynamicProtocols.map((_, i) => {
        const colors = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
        return colors[i % colors.length];
      });

      protocolChart.data.labels = dynamicProtocols;
      protocolChart.data.datasets[0].data = dynamicCounts;
      protocolChart.data.datasets[0].backgroundColor = dynamicColors;
      protocolChart.update();

      Object.keys(dynamicProtocolCounts).forEach(proto => {
        if (!protocolHistory[proto]) {
          protocolHistory[proto] = [];
        }
        protocolHistory[proto].push(dynamicProtocolCounts[proto]);
        if (protocolHistory[proto].length > 20) {
          protocolHistory[proto].shift();
        }
      });

      Object.keys(protocolHistory).forEach(proto => {
        if (!dynamicProtocolCounts[proto]) {
          protocolHistory[proto].push(0);
          if (protocolHistory[proto].length > 20) {
            protocolHistory[proto].shift();
          }
        }
      });

      const colors = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
      const datasets = Object.keys(protocolHistory).map((proto, i) => ({
        label: proto,
        data: protocolHistory[proto],
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33',
        tension: 0.3
      }));

      const nowTime = new Date().toLocaleTimeString();
      timeLabels.push(nowTime);
      if (timeLabels.length > 20) {
        timeLabels.shift();
      }
      protocolOverTimeChart.data.labels = timeLabels;
      protocolOverTimeChart.data.datasets = datasets;
      protocolOverTimeChart.update();

      let portUsage = {};

      data.forEach(pkt => {
        const ports = [pkt.src_port, pkt.dst_port];
        ports.forEach(port => {
          if (port && !isNaN(port)) {
            portUsage[port] = (portUsage[port] || 0) + 1;
          }
        });
      });

      const sortedPorts = Object.entries(portUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const topPorts = sortedPorts.map(([port]) => port);
      const topCounts = sortedPorts.map(([_, count]) => count);

      const backgroundColors = topPorts.map(port => {
      if (!portColors[port]) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        portColors[port] = `rgba(${r}, ${g}, ${b}, 0.7)`;
      }
      return portColors[port];
    });

    commonPortsChart.data.labels = topPorts;
    commonPortsChart.data.datasets[0].data = topCounts;
    commonPortsChart.data.datasets[0].backgroundColor = backgroundColors;

    commonPortsChart.update();

    })
    .catch(err => console.error('Error updating charts:', err));
}

function makeModalDraggable(modal) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  modal.addEventListener('mousedown', (e) => {
    if (e.target.closest('.modal-header') || e.target === modal) {
      isDragging = true;
      offsetX = e.clientX - modal.getBoundingClientRect().left;
      offsetY = e.clientY - modal.getBoundingClientRect().top;
      modal.style.cursor = 'move';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      modal.style.left = `${e.clientX - offsetX}px`;
      modal.style.top = `${e.clientY - offsetY}px`;
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
      modal.style.transform = 'none';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    modal.style.cursor = 'default';
  });
}

const toolsBtn = document.getElementById('tools-menu-button');
const toolsPanel = document.getElementById('tools-panel');
const timeToolBtn = document.getElementById('time-tool-btn');
const timeModal = document.getElementById('time-tool-modal');
const timeDisplay = document.getElementById('time-display');
const positionSelect = document.getElementById('modal-position-select');

toolsBtn.addEventListener('click', () => {
  toolsPanel.classList.toggle('hidden');
  toolsBtn.classList.toggle('active');
});

timeToolBtn.addEventListener('click', () => {
  timeModal.classList.remove('hidden'); 
  positionModal('center')
});

positionSelect.addEventListener('change', () => {
  positionModal(positionSelect.value);
});

document.getElementById('close-time-modal').addEventListener('click', () => {
  document.getElementById('time-tool-modal').classList.add('hidden');
});

const timeModeSelect = document.getElementById('modal-position-select');
const exactTimeContainer = document.getElementById('exact-time-container');
const rangeTimeContainer = document.getElementById('range-time-container');

timeModeSelect.addEventListener('change', (e) => {
  const selectedMode = e.target.value;
  if (selectedMode === 'exact') {
    exactTimeContainer.classList.remove('hidden');
    rangeTimeContainer.classList.add('hidden');
  } else if (selectedMode === 'range') {
    exactTimeContainer.classList.add('hidden');
    rangeTimeContainer.classList.remove('hidden');
  }
});
makeModalDraggable(timeModal);

const modeSelect = document.getElementById('modal-position-select');
  const exactContainer = document.getElementById('exact-time-container');
  const rangeContainer = document.getElementById('range-time-container');

  function updateTimeFilterUI(mode) {
    if (mode === 'exact') {
      exactContainer.classList.remove('hidden');
      rangeContainer.classList.add('hidden');
      timeModal.style.height = '170px';
    } else if (mode === 'range') {
      exactContainer.classList.add('hidden');
      rangeContainer.classList.remove('hidden');
      timeModal.style.height = '250px'; 
    }
  }

  modeSelect.addEventListener('change', (e) => {
    updateTimeFilterUI(e.target.value);
  });

  updateTimeFilterUI(modeSelect.value);

const portToolBtn = document.getElementById("port-tool-btn");
const portToolModal = document.getElementById("port-tool-modal");
const closePortModal = document.getElementById("close-port-modal");
const scanPortsBtn = document.getElementById("scan-ports-btn");
const portResults = document.getElementById("port-results");
let autoScanEnabled = false;
let autoScanIntervalId = null;
const autoScanToggle = document.getElementById("auto-scan-toggle");
let lastScannedIndex = 0;

autoScanToggle.addEventListener("change", () => {
  autoScanEnabled = autoScanToggle.checked;

  if (autoScanEnabled) {
    startAutoScan();
  } else {
    stopAutoScan();
  }
});

function startAutoScan() {
  autoScanIntervalId = setInterval(() => {
    runPortScan({ silent: true, source: "auto" });
  }, 10000);
}

function stopAutoScan() {
  clearInterval(autoScanIntervalId);
  autoScanIntervalId = null;
}

scanPortsBtn.addEventListener("click", () => {
  runPortScan({ silent: false });
});


// Predetermined list of dangerous ports
const knownDangerousPorts = [
  "21",   // FTP
  "23",   // Telnet
  "25",   // SMTP
  "135",  // RPC
  "139",  // NetBIOS
  "445",  // SMB
  "1433", // MSSQL
  "3306", // MySQL
  "3389", // RDP
  "5900", // VNC
  "6667", // IRC
  "8080", // Common proxy
];

portToolBtn.addEventListener("click", () => {
  portToolModal.classList.remove("hidden");
});

closePortModal.addEventListener("click", () => {
  portToolModal.classList.add("hidden");
});

let portScanTimeoutId = null; 

const alertBox = document.getElementById("port-alert");
console.log(alertBox);
const alertSound = document.getElementById("alert-sound");

function performPortScanLogic(silent = false, source = "manual") {
  alertBox.classList.add("hidden");
  alertSound.pause();
  alertSound.currentTime = 0;

  const input = document.getElementById("custom-ports").value;
  const userPorts = input
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== "");

  const allPorts = [...new Set([...knownDangerousPorts, ...userPorts])];
  const filteredData = applyFilters(globalPacketData);

  let matches = [];

  const packetsToCheck = source === "auto"
    ? filteredData.slice(lastScannedIndex)
    : filteredData;

  for (let i = packetsToCheck.length - 1; i >= 0; i--) {
    const packet = packetsToCheck[i];
    const srcDetail = `${packet.src}:${packet.src_port}`;
    const dstDetail = `${packet.dst}:${packet.dst_port}`;
    const proto = (packet.proto || "Unknown").toLowerCase();

    for (const port of allPorts) {
      if (String(packet.src_port) === port || String(packet.dst_port) === port) {
        const match = `<li>${srcDetail} → ${dstDetail} (Protocol: ${proto}, Port: ${port})</li>`;
        matches.push(match);

        if (source === "auto") {
          break;
        }
      }
    }

    if (source === "auto" && matches.length) {
      break;
    }
  }

  if (source === "auto") {
    lastScannedIndex = filteredData.length;
  }

  if (!silent && source === "manual") {
    portResults.innerHTML = matches.length
      ? `<ul>${matches.join("")}</ul>`
      : "<p>No suspicious ports found.</p>";
  }

  if (matches.length) {
    alertBox.classList.remove("hidden");
    alertSound.play().catch(err => console.warn("Audio play failed:", err));

    if (source === "auto") {
      const autoScanResults = document.getElementById("auto-scan-results");
      autoScanResults.innerHTML = `<ul>${matches.join("")}</ul>`;
    }

    setTimeout(() => {
      alertBox.classList.add("hidden");
    }, 6000);
  }
}

const loadingOverlay = document.getElementById("global-loading-overlay");

function runPortScan({ silent = false, source = "manual" }) {

  if (!silent) {
    loadingOverlay.classList.remove("hidden");

    setTimeout(() => {
      const delay = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;

      portScanTimeoutId = setTimeout(() => {
        performPortScanLogic(silent, source);
        loadingOverlay.classList.add("hidden");
        portScanTimeoutId = null;
      }, delay);
    }, 50);
  } else {
    performPortScanLogic(silent, source);
  }
}


document.getElementById("cancel-port-scan").addEventListener("click", () => {
  if (portScanTimeoutId) {
    clearTimeout(portScanTimeoutId);
    portScanTimeoutId = null;
  }

  document.getElementById("port-loading-overlay").classList.add("hidden");
  portResults.innerHTML = "<p>Scan cancelled by user.</p>";
});


function exportToCSV(data) {
  if (!data.length) return;
  
  const orderedHeaders = ['time', 'src', 'src_port', 'dst', 'dst_port', 'proto'];
  const csvRows = [orderedHeaders.join(',')];

  data.forEach(row => {
    const values = orderedHeaders.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'packets_export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.getElementById('export-btn').addEventListener('click', () => {
  const filteredData = applyFilters(globalPacketData);
  exportToCSV(filteredData);
});
makeModalDraggable(portToolModal);

const blacklistToolBtn = document.getElementById("blacklist-tool-btn");
const blacklistModal = document.getElementById("blacklist-tool-modal");
const closeBlacklistModal = document.getElementById("close-blacklist-modal");
const runBlacklistScan = document.getElementById("run-blacklist-scan");
const blacklistResults = document.getElementById("blacklist-results");
let scanCancelled = false;
let autoBlacklistScanEnabled = false;
let autoBlacklistScanIntervalId = null;
let lastBlacklistScannedIndex = null;
let blacklistAlertQueue = [];
let isShowingAlert = false;
let blacklistScanDirection = "oldest";

function sendBlockedIPsToBackend() {
  const ipsToBlock = Array.from(blockedIPs);

  fetch('/api/block_ips', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ips: ipsToBlock })
  })
  .then(response => response.json())
  .then(data => {
    console.log("✅ Sent to backend:", data.blocked);
  })
  .catch(error => {
    console.error("❌ Error sending blocked IPs:", error);
  });
}

function sendUnblockedIPsToBackend() {
  const ipsToUnblock = Array.from(blockedIPs);

  fetch('/api/unblock_ips', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ips: ipsToUnblock })
  })
  .then(response => response.json())
  .then(data => {
    console.log("✅ Unblocked on backend:", data.blocked);
  })
  .catch(error => {
    console.error("❌ Error unblocking IPs:", error);
  });
}


function startAutoBlacklistScan() {
  autoBlacklistScanIntervalId = setInterval(() => {
    runBlacklistAutoScan(); 
  }, 10000); 
}

function stopAutoBlacklistScan() {
  if (autoBlacklistScanIntervalId !== null) {
    clearInterval(autoBlacklistScanIntervalId);
    autoBlacklistScanIntervalId = null;
    console.log("⛔ Interval cleared!");
  }

  autoBlacklistScanEnabled = false;
  blacklistAlertQueue = [];
  isShowingAlert = false;

  const alertBox = document.getElementById("blacklist-alert-box");
  if (alertBox && !alertBox.classList.contains("hidden")) {
    alertBox.classList.remove("hidden");
    alertBox.classList.add("fade-out");
    setTimeout(() => {
      alertBox.classList.remove("fade-out");
      alertBox.classList.add("hidden");
    }, 600);
  }

  const resultsBox = document.getElementById("blacklist-results");
  if (resultsBox) {
    resultsBox.innerHTML = "";
  }

  console.log("🧹 Auto blacklist scan, alerts, and results cleared with fade-out.");
}


blacklistToolBtn.addEventListener("click", () => {
  blacklistModal.classList.remove("hidden");
});
closeBlacklistModal.addEventListener("click", () => {
  blacklistModal.classList.add("hidden");
});

runBlacklistScan.addEventListener("click", () => {
  scanCancelled = false; 
  const fileInput = document.getElementById("blacklist-file");
  const manualInput = document.getElementById("manual-blacklist-input").value;

  loadingOverlay.classList.remove("hidden"); 

  setTimeout(() => {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const fileText = e.target.result;
        const blacklist = parseBlacklist(fileText, manualInput);
        scanAgainstBlacklist(blacklist);
        loadingOverlay.classList.add("hidden"); 
      };
      reader.readAsText(file);
    } else {
      const blacklist = parseBlacklist("", manualInput);
      scanAgainstBlacklist(blacklist);
      loadingOverlay.classList.add("hidden"); 
    }
  }, Math.random() * 1500 + 500); 
});

function parseBlacklist(fileContent, manualInput) {
  const combined = `${fileContent}\n${manualInput}`;
  return new Set(
    combined
      .split(/[\n,]/)
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0)
  );
}
const alertBlacklistBox = document.getElementById("blacklist-alert-box");
const alertBlacklistSound = document.getElementById("alert-sound");

function scanAgainstBlacklist(blacklistSet) {
  if (scanCancelled) return;

  const filteredData = applyFilters(globalPacketData);
  const hits = [];

  alertBlacklistBox.innerText = "";
  alertBlacklistBox.classList.add("hidden");

  for (const packet of filteredData) {
    if (scanCancelled) return;

    if (blacklistSet.has(packet.src) || blacklistSet.has(packet.dst)) {
      hits.push(`<li>${packet.time} – ${packet.src} → ${packet.dst} (${packet.proto})</li>`);
    }
  }

  if (!scanCancelled) {
    if (hits.length) {
      alertBlacklistBox.innerText = `⚠ Blacklist Match Found`;
      alertBlacklistBox.classList.remove("hidden");

      alertBlacklistSound.pause();
      alertBlacklistSound.currentTime = 0;
      alertBlacklistSound.play().catch(err => console.warn("Audio play failed:", err));

      setTimeout(() => {
        alertBlacklistBox.classList.add("hidden");
      }, 6000);
    }

    blacklistResults.innerHTML = hits.length
      ? `<ul>${hits.join("")}</ul>`
      : "<p>No matches found.</p>";
  }
}




const cancelScanBtn = document.getElementById("cancel-port-scan");

cancelScanBtn.addEventListener("click", () => {
  scanCancelled = true;
  loadingOverlay.classList.add("hidden");
  blacklistResults.innerHTML = "<p>Scan cancelled by user.</p>";
});

const fileInput = document.getElementById("blacklist-file");
const fileNameDisplay = document.getElementById("blacklist-file-name");

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameDisplay.textContent = `✔ File loaded: ${fileInput.files[0].name}`;
    fileNameDisplay.style.color = "#00ff99";
  } else {
    fileNameDisplay.textContent = "No file selected";
    fileNameDisplay.style.color = "#ccc";
  }
});
makeModalDraggable(blacklistModal);

function runBlacklistAutoScan() {
  if (!autoBlacklistScanEnabled) return;
  const fileInput = document.getElementById("blacklist-file");
  const manualInput = document.getElementById("manual-blacklist-input").value;

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!autoBlacklistScanEnabled) {
        console.log("🛑 Scan skipped after file read — auto scan disabled.");
        return;
      }

      const fileText = e.target.result;
      const blacklist = parseBlacklist(fileText, manualInput);
      scanAgainstBlacklistAuto(blacklist);
    };

    reader.readAsText(file);
  } else {
    if (!autoBlacklistScanEnabled) return;
    const blacklist = parseBlacklist("", manualInput);
    scanAgainstBlacklistAuto(blacklist);
  }
}

function scanAgainstBlacklistAuto(blacklistSet) {
 const filteredData = applyFilters(globalPacketData);
  if (!autoBlacklistScanEnabled) return;

  let packetsToCheck = [];

  if (blacklistScanDirection === "oldest") {
    packetsToCheck = filteredData.slice(lastBlacklistScannedIndex || 0);
    lastBlacklistScannedIndex = filteredData.length;

  } else if (blacklistScanDirection === "latest") {
    packetsToCheck = filteredData.slice().reverse();
    lastBlacklistScannedIndex = filteredData.length;

  } else if (blacklistScanDirection === "latest-forward") {
    if (lastBlacklistScannedIndex == null) {
      console.log("⚠️ Skipping first scan in 'latest-forward' mode.");
      lastBlacklistScannedIndex = filteredData.length;
      return;
    }

    if (lastBlacklistScannedIndex >= filteredData.length) {
      console.log("✅ No new packets to scan.");
      return;
    }
    
    packetsToCheck = filteredData.slice(lastBlacklistScannedIndex);
    lastBlacklistScannedIndex = filteredData.length;
  }

  const matches = [];

  for (const packet of packetsToCheck) {
    if (!autoBlacklistScanEnabled) break; 

    if (blacklistSet.has(packet.src) || blacklistSet.has(packet.dst)) {
      const detail = `${packet.time} – ${packet.src} → ${packet.dst} (${packet.proto})`;
      matches.push(`<li>${detail}</li>`);
      blacklistAlertQueue.push(detail);
    }
  }

  lastBlacklistScannedIndex = filteredData.length;
  processNextBlacklistAlert(); 
}


function processNextBlacklistAlert() {
  if (isShowingAlert || blacklistAlertQueue.length === 0) return;

  isShowingAlert = true;
  const detail = blacklistAlertQueue.shift();

  showBlacklistAlert(detail);

  setTimeout(() => {
    isShowingAlert = false;
    processNextBlacklistAlert(); 
  }, 6000); 
}


const optionsToggle = document.getElementById("options-toggle");
const optionsMenu = document.getElementById("blacklist-options-menu");
const optionItems = document.querySelectorAll(".option-item");

optionsToggle.addEventListener("click", () => {
  optionsMenu.classList.toggle("hidden");
});

optionItems.forEach(item => {
  item.addEventListener("click", () => {
    item.classList.toggle("active");
    const optionType = item.dataset.option;
    switch (optionType) {
      case "auto-scan":
        autoBlacklistScanEnabled = item.classList.contains("active");
        autoBlacklistScanEnabled ? startAutoBlacklistScan() : stopAutoBlacklistScan();
        break;

      case "block":
        const isBlocking = item.classList.contains("active");
        if (isBlocking) {
          const fileInput = document.getElementById("blacklist-file");
          const manualInput = document.getElementById("manual-blacklist-input").value;

          if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const fileText = e.target.result;
              const blacklist = parseBlacklist(fileText, manualInput);
              blacklist.forEach(ip => blockedIPs.add(ip));
                console.log("🚫 Blocking enabled for IPs:", [...blockedIPs]);
                sendBlockedIPsToBackend();  
                fetchPackets();
            };
            reader.readAsText(file);
          } else {
            const blacklist = parseBlacklist("", manualInput);
            blacklist.forEach(ip => blockedIPs.add(ip));
            console.log("🚫 Blocking enabled for IPs:", [...blockedIPs]);
            sendBlockedIPsToBackend();  
            fetchPackets();
          }
        } else {
              sendUnblockedIPsToBackend();     
              blockedIPs.clear();             
              console.log("✅ Blocking disabled. IPs cleared.");
              fetchPackets();
            }
        break;
    }
  });
});


function showBlacklistAlert(detail) {

  alertBlacklistBox.classList.remove("hidden");
  alertBlacklistBox.innerText = `⚠ Blacklist Match Found: ${detail}`;

  alertBlacklistSound.pause();
  alertBlacklistSound.currentTime = 0;
  alertBlacklistSound.play().catch(err => console.warn("Audio play failed:", err));

  const autoResults = document.getElementById("blacklist-results");
  let ul = autoResults.querySelector("ul");

  if (!ul) {
    ul = document.createElement("ul");
    autoResults.innerHTML = "";
    autoResults.appendChild(ul);
  }

  const li = document.createElement("li");
  li.innerText = detail;
  ul.appendChild(li);

  setTimeout(() => {
    alertBlacklistBox.classList.add("hidden");
  }, 6000);
}

const submenuParent = document.querySelector(".with-submenu");
const submenu = submenuParent.querySelector(".submenu");

let submenuTimeout;

submenuParent.addEventListener("mouseenter", () => {
  clearTimeout(submenuTimeout);
  submenu.style.display = "block";
});

submenuParent.addEventListener("mouseleave", () => {
  submenuTimeout = setTimeout(() => {
    submenu.style.display = "none";
  }, 200); 
});

submenu.addEventListener("mouseenter", () => {
  clearTimeout(submenuTimeout);
});

submenu.addEventListener("mouseleave", () => {
  submenuTimeout = setTimeout(() => {
    submenu.style.display = "none";
  }, 200);
});


document.querySelectorAll(".submenu-item").forEach(item => {
  const filteredData = applyFilters(globalPacketData);
  item.addEventListener("click", () => {
    document.querySelectorAll(".submenu-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    
    blacklistScanDirection = item.dataset.scanDir;
    if (blacklistScanDirection === "latest-forward") {
      lastBlacklistScannedIndex = globalPacketData.length;
    } else if (blacklistScanDirection === "latest") {
      lastBlacklistScannedIndex = 0;
    } else {
      lastBlacklistScannedIndex = 0; 
    }

    console.log(`📍 Scan direction set to: ${blacklistScanDirection}`);
  });
});
