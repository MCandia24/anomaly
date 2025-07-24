   // Crear mapa
    const radius = 25;     // Tamaño del área de influencia de cada punto
    const opacity = 0.6;   // Transparencia del heatmap
    // 1. Map Initialization
    const map = L.map('map').setView([40.7128, -74.0060], 11); // Center on New York with zoom 12

    // OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Global variables to store data and control state
    let allData = []; // Stores all loaded anomaly data
    let filteredData = []; // Stores data after applying filters (date, etc.)
    let timeAxis = []; // Array of unique sorted timestamps for the date slider
    let heatLayer; // heatmap puro
    let anomalyTooltipLayer; // Capa para markers de tooltips
    let heatmapAnomalousLayer;
    let heatmapNormalLayer;
    let dateInput, rangeHour, rangeHourValue;
    document.addEventListener("DOMContentLoaded", () => {
    dateInput = document.getElementById("date-value");
    rangeHour = document.getElementById("range-hour");
    rangeHourValue = document.getElementById("range-hour-value");

  const defaultDate = "2014-04-01";
  dateInput.value = defaultDate;
  loadJSONData(defaultDate);

  dateInput.addEventListener("change", () => {
    loadJSONData(dateInput.value);
  });

  rangeHour.addEventListener("input", () => {
    rangeHourValue.textContent = rangeHour.value;
    applyFilters(); // aplicar filtro por hora
  });
});



    async function loadJSONData(dateStr) {
    //console.log("🚀 Ejecutando función loadJSONData()");
    console.log("📅 Solicitando datos para la fecha:", dateStr);
  try {
    const response = await fetch('http://127.0.0.1:8001/api/uber-trips/values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_code: dateStr })
    });

    if (!response.ok) {
      throw new Error('Error al obtener datos.');
    }

    const apiData = await response.json();
const anomalousRaw = apiData.result?.anomalous?.data ?? [];
const anomalousTime = apiData.result?.anomalous?.time_index ?? [];
const normalRaw = apiData.result?.non_anomalous?.data ?? [];
const normalTime = apiData.result?.non_anomalous?.time_index ?? [];


const anomalous = extractPoints(anomalousRaw).map(([lat, lng], i) => ({
  lat, lng,
  value: 10,
  type: 'Anomalía',
  level: 'critical',
  timestamp: new Date(anomalousTime[i % anomalousTime.length] ?? Date.now()),
  message: `Anomalía detectada el ${anomalousTime[i % anomalousTime.length] ?? 'desconocido'}`
}));

const normal = extractPoints(normalRaw).map(([lat, lng], i) => ({
  lat, lng,
  value: 2,
  type: 'Normal',
  level: 'info',
  timestamp: new Date(normalTime[i % normalTime.length] ?? Date.now()),
  message: `Dato normal detectado el ${normalTime[i % normalTime.length] ?? 'desconocido'}`
}));


    allData = [...anomalous, ...normal];
    allData.sort((a, b) => a.timestamp - b.timestamp);
      timeAxis = [...new Set(allData.map(a => a.timestamp.getTime()))]
      .sort((a, b) => a - b)
      .map(t => new Date(t));

 //   console.log("📊 Datos recibidos:", apiData);
 //   console.log("🔴 Anomalías:", anomalous.length, "🟢 Normales:", normal.length);
  applyFilters();

   } catch (error) {
    console.error("❌ Error:", error);
    
  }
}

    // Function to generate dummy data (as a fallback)
    function generateAnomalyData() {
      const anomalies = [];
      const types = ['Intrusión', 'Error', 'Comportamiento', 'Acceso'];
      const levels = ['critical', 'warning', 'info'];

      for (let i = 0; i < 50; i++) {
        const lat = 40.7128 + (Math.random() * 0.1 - 0.05); // New York ±0.05 degrees
        const lng = -74.0060 + (Math.random() * 0.01 - 0.005);
        const value = Math.floor(Math.random() * 10) + 1;
        const type = types[Math.floor(Math.random() * types.length)];
        const level = levels[Math.floor(Math.random() * levels.length)];

        anomalies.push({
          lat,
          lng,
          value,
          type,
          level,
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
          message: `${type} detectado en ubicación ${i + 1}`
        });
      }
      return anomalies;
    }

    /**
     * Main function to apply all active filters (date, radius, opacity) to the data.
     * Updates the heatmap, charts, and stats based on the filtered data.
     */


function applyFilters() {

   const selectedHour = parseInt(rangeHour.value);
  if (selectedHour === 24) {
    filteredData = [...allData]; // sin filtro
  } else {
    filteredData = allData.filter(d => d.timestamp.getHours() === selectedHour);
  }
  console.log("✅ Datos filtrados:", filteredData.length);

 


// Separar anomalías y normales

  const anomalousData = filteredData
    .filter(d => d.level === 'critical' || d.level === 'warning')
    .map(d => [d.lat, d.lng, d.value]);

  const normalData = filteredData
    .filter(d => d.level === 'info')
    .map(d => [d.lat, d.lng, d.value]);



  // Luego sigues con crear las capas
 

// Primero la capa de normales (fondo)
heatmapNormalLayer = L.heatLayer(normalData, {
  radius,
  maxZoom: 13,
  max: 10,
  blur: 8,
  gradient: { 0.4: 'blue', 0.6: 'lime', 1.0: 'yellow' },
  opacity: opacity  // más bajo aún
}).addTo(map);



// Luego capa de anomalías (por encima)
heatmapAnomalousLayer = L.heatLayer(anomalousData, {
  radius,
  maxZoom: 13,
  max: 10,
  blur: 8,
  //gradient: { 0.3: 'orange', 0.6: 'red', 1.0: '#8B0000' },
  gradient: { 0.4: 'red', 0.6: 'red', 0.1: 'red' },
   //gradient: { 0.8: 'red', 1.0: 'red' },
  // gradient: { 1.0: 'red' },
  opacity: opacity // total
}).addTo(map);


if (anomalyTooltipLayer) {
  map.removeLayer(anomalyTooltipLayer); // Quita los antiguos
}
anomalyTooltipLayer = L.layerGroup(); // Nueva capa vacía

function jitter(value) {
  return value + (Math.random() - 0.5) * 0.0003; // Ruido leve
}

filteredData
  .filter(d => d.level === 'critical' || d.level === 'warning')
  .forEach((d, i) => {
    const lat = jitter(d.lat);
    const lng = jitter(d.lng);

    const marker = L.circleMarker([lat, lng], {
      radius: 4,
      color: 'blue',
      fillColor: 'blue',
      fillOpacity: 0.5,
      weight: 1
    });

    marker.bindTooltip(`<strong>${d.message}</strong><br><strong>Lat:</strong> ${d.lat}<br><strong>Lng:</strong> ${d.lng}<br><strong>Nivel:</strong> ${d.level}`, {
      permanent: false,
      direction: 'top',
      offset: [0, -5],
      opacity: 0.9
    });

    anomalyTooltipLayer.addLayer(marker);
  });


anomalyTooltipLayer.addTo(map); // <-- Esto está bien
//------------------------
  // Actualizar estadísticas, gráficos y alertas
  updateStats(filteredData);
  updateCharts(filteredData);
  updateAlertList(filteredData);
 
}


    /**
     * Updates the statistics cards in the sidebar.
     * @param {Array} data - The data to use for calculating statistics.
     */
    function updateStats(data) {
      const critical = data.filter(a => a.level === 'critical').length;
      const warning = data.filter(a => a.level === 'warning').length;
      const total = data.length;
      const normalPercentage = total > 0 ? Math.round((total - critical - warning) / total * 100) : 0;

      document.getElementById('critical-count').textContent = critical;
      document.getElementById('warning-count').textContent = total;
      document.getElementById('normal-count').textContent = `${normalPercentage}%`;
    }

    /**
     * Updates the time series and distribution charts.
     * @param {Array} data - The data to use for charting.
     */
    function updateCharts(data) {
      // Group by hour of the day for the time series chart
      const hours = {};
      data.forEach(anomaly => {
        const hour = anomaly.timestamp.getHours();
        hours[hour] = hours[hour] || { normal: 0, anomalous: 0 };

        if (anomaly.level === 'critical' || anomaly.level === 'warning') {
          hours[hour].anomalous++;
        } else {
          hours[hour].normal++;
        }
      });

      const timeLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      const normalTimeData = timeLabels.map((_, i) => hours[i]?.normal || 0);
      const anomalyTimeData = timeLabels.map((_, i) => hours[i]?.anomalous || 0);

      // Time Series Chart
      const timeCtx = document.getElementById('timeSeriesChart').getContext('2d');
      if (window.timeChart) {
        window.timeChart.destroy(); // Destroy previous chart instance
      }

      window.timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [{
            label: 'Eventos normales',
            data: normalTimeData,
            borderColor: 'rgba(75, 192, 192, 1)',
            tension: 0.1,
            fill: false
          }, {
            label: 'Anomalías',
            data: anomalyTimeData,
            borderColor: 'rgba(255, 99, 132, 1)',
            tension: 0.1,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: {
                display: true,
                text: 'Hora del día'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Número de eventos'
              },
              beginAtZero: true
            }
          }
        }
      });

      // Distribution Chart (anomalies vs. normal)
      const typeCtx = document.getElementById('distributionChart').getContext('2d');
      const anomalousCount = data.filter(a => a.level === 'critical' || a.level === 'warning').length;
      const normalCount = data.length - anomalousCount;

      if (window.typeChart) {
        window.typeChart.destroy(); // Destroy previous chart instance
      }

      window.typeChart = new Chart(typeCtx, {
        type: 'doughnut',
        data: {
          labels: ['Anomalías', 'Normales'],
          datasets: [{
            data: [anomalousCount, normalCount],
            backgroundColor: [
              '#dc3545', // Red for anomalies
              '#28a745'  // Green for normal
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom' // Place legend at the bottom
            }
          }
        }
      });
    }

    /**
     * Updates the list of recent alerts in the sidebar.
     * @param {Array} data - The data to use for alerts.
     */
    function updateAlertList(data) {
      const alertList = document.getElementById('alert-list');
      alertList.innerHTML = '';

      // Sort by timestamp (most recent first) and filter for critical/warning
      const sortedAnomalies = [...data]
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter(a => a.level === 'critical' || a.level === 'warning')
        .slice(0, 10); // Show only the 5 most recent

      if (sortedAnomalies.length === 0) {
        alertList.innerHTML = '<p class="text-muted">No hay alertas recientes.</p>';
      } else {
        sortedAnomalies.forEach(anomaly => {
          const alertDiv = document.createElement('div');
          alertDiv.className = `anomaly-alert ${anomaly.level === 'critical' ? '' : 'warning'}`;
          const formattedDate = anomaly.timestamp.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
          alertDiv.innerHTML = `<strong>${anomaly.type}</strong>: ${anomaly.message}`;
          alertList.appendChild(alertDiv);
        });
      }
    }


  //  loadJSONData(defaultDate);

    /**
     * Flattens any structure and returns up to `max` [lat,lng] pairs.
     * Also accepts {lat,lng} objects.
     * @param {Array|Object} raw - The raw data to extract points from.
     * @param {number} max - The maximum number of points to extract.
     * @returns {Array<[number, number]>} An array of [latitude, longitude] pairs.
     */
function extractPoints(raw) {
  const out = [];
  const stack = Array.isArray(raw) ? [...raw] : [raw];

  while (stack.length) {
    const item = stack.pop();

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const { lat, lng } = item;
      if (Number.isFinite(+lat) && Number.isFinite(+lng)) {
        out.push([+lat, +lng]);
      } else {
        Object.values(item).forEach(v => stack.push(v));
      }
      continue;
    }

    if (Array.isArray(item) && item.length === 2 &&
        Number.isFinite(+item[0]) && Number.isFinite(+item[1])) {
      out.push([+item[0], +item[1]]);
    } else if (Array.isArray(item)) {
      stack.push(...item);
    }
  }

  return out;
}