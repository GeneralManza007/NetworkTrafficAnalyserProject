let globalPacketData = [];

function renderPackets(data) {
  const tableBody = document.getElementById('packet-table');
  tableBody.innerHTML = '';

  data.slice().reverse().forEach(packet => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${packet.time}</td>
      <td>${packet.src}</td>
      <td>${packet.dst}</td>
      <td>${packet.proto}</td>
    `;
    tableBody.appendChild(row);
  });
}

function fetchPackets() {
  fetch('/api/packets')
    .then(response => response.json())
    .then(data => {
      globalPacketData = data;
      const filteredData = applyFilters(data);
      renderPackets(filteredData);
    })
    .catch(error => console.error('Error fetching packets:', error));
}

document.getElementById('protocolFilter').addEventListener('input', fetchPackets);
document.getElementById('srcFilter').addEventListener('input', fetchPackets);
document.getElementById('dstFilter').addEventListener('input', fetchPackets);

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

const packetCountCtx = document.getElementById('packetCountChart').getContext('2d');

const packetChart = new Chart(packetCountCtx, {
  type: 'line',
  data: {
    labels: timeLabels,
    datasets: [{
      label: 'Packets over Time',
      data: packetCounts,
      borderColor: 'lime',
      backgroundColor: 'rgba(0,255,0,0.1)',
      tension: 0.3
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
    datasets: [] // Start empty; dynamically filled
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

document.getElementById('export-charts-btn').addEventListener('click', () => {
  const chart1 = document.getElementById('packetCountChart');
  const chart2 = document.getElementById('protocolChart');
  const chart3 = document.getElementById('protocolOverTimeChart');

  const width = Math.max(chart1.width, chart2.width, chart3.width);
  const height = chart1.height + chart2.height + chart3.height;

  const combinedCanvas = document.createElement('canvas');
  combinedCanvas.width = width;
  combinedCanvas.height = height;

  const ctx = combinedCanvas.getContext('2d');

  // Draw charts stacked vertically
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

// Stop (pause + clear charts)
stopBtn.addEventListener('click', () => {
  clearControlStates();
  stopBtn.classList.add('active-stop');
  clearInterval(intervalId);
  intervalId = null;
  monitoring = false;

  // Clear data
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

  // Clear frontend state
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
  const exactTime = document.getElementById('exactTime').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;

  const startTimeWithSeconds = startTime ? startTime + ':00' : null;
  const endTimeWithSeconds = endTime ? endTime + ':00' : null;

  return data.filter(packet => {
    const packetTime = packet.time || '';

    if (exactTime) {
      return packetTime === exactTime;
   }
    const matchesStartTime = !startTimeWithSeconds || packetTime >= startTimeWithSeconds;
    const matchesEndTime = !endTimeWithSeconds || packetTime <= endTimeWithSeconds;
    const matchesProtocol = !protocol || (packet.proto && packet.proto.toLowerCase().includes(protocol));
    const matchesSrc = !src || packet.src.includes(src);
    const matchesDst = !dst || packet.dst.includes(dst);

    return matchesStartTime && matchesEndTime && matchesProtocol && matchesSrc && matchesDst;
  });
}





function updateChartsAndPackets() {
  fetchPackets();
  updatePacketCount();

  fetch('/api/packets')
    .then(res => res.json())
    .then(data => {
      globalPacketData = data;
      const now = new Date();
      const label = now.toLocaleTimeString();

      // Update time and packet count
      timeLabels.push(label);
      if (timeLabels.length > 20) timeLabels.shift();

      packetCounts.push(data.length);
      if (packetCounts.length > 20) packetCounts.shift();
      packetChart.update();

      dynamicProtocolCounts = {}; // reset

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

      // Track history for each protocol
      Object.keys(dynamicProtocolCounts).forEach(proto => {
        if (!protocolHistory[proto]) {
          protocolHistory[proto] = [];
        }
        protocolHistory[proto].push(dynamicProtocolCounts[proto]);
        if (protocolHistory[proto].length > 20) {
          protocolHistory[proto].shift();
        }
      });

      // Fill missing protocols with 0
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

      protocolOverTimeChart.data.datasets = datasets;
      protocolOverTimeChart.update();
    })
    .catch(err => console.error('Error updating charts:', err));
}

const toolsBtn = document.getElementById('tools-menu-button');
const toolsPanel = document.getElementById('tools-panel');
const timeToolBtn = document.getElementById('time-tool-btn');
const timeModal = document.getElementById('time-tool-modal');
const timeDisplay = document.getElementById('time-display');
const positionSelect = document.getElementById('modal-position-select');

// Toggle tool panel
toolsBtn.addEventListener('click', () => {
  toolsPanel.classList.toggle('hidden');
  toolsBtn.classList.toggle('active');
});

// Show time tool modal
timeToolBtn.addEventListener('click', () => {
  timeModal.classList.remove('hidden'); 
  positionModal('center')
});

positionSelect.addEventListener('change', () => {
  positionModal(positionSelect.value);
});


// Set modal position
let isDragging = false;
let offsetX, offsetY;

const modal = document.getElementById('time-tool-modal');

// Add mouse event listeners to the modal header (or the whole modal if no header)
modal.addEventListener('mousedown', (e) => {
  // Only allow dragging from top portion of modal (optional)
  if (e.target.closest('#time-tool-modal')) {
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
    modal.style.transform = 'none'; // Remove center transform if user moves
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  modal.style.cursor = 'default';
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