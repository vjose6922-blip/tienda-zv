const WEATHER_API_URL = API_URL;
const LOOKS_CACHE_KEY = 'zr_looks_generated_v2';
const MAX_WEATHER_RETRIES = 5;
const RETRY_DELAYS = [1000, 3000, 5000, 10000, 30000];
const DEFAULT_COORDS = '27.4863,-99.5162'; 

let weatherRetryCount = 0;
let weatherRetryTimer = null;
let bgProductsRetryCount = 0;
let bgProductsRetryTimer = null;
const MAX_BG_PRODUCTS_RETRIES = 5;
const BG_PRODUCTS_RETRY_DELAYS = [3000, 6000, 10000, 20000, 30000];
let weatherUpdateInterval = null;
let currentWeather = null;
let allProducts = [];
let looks = [];
let allLooks = [];
let currentLooksPage = 1;
let looksPerPage = 10;
let isGeneratingLooks = false;
let preloadedNextPage = null;
let lazyImageObserver = null;
let isPreloading = false;

const WEATHER_IMAGES = {
  
  'amanecer_aguanieve': '1nhMnXB76Y4iWrP9LXoKZt0UbIw9_xwlO',
  'amanecer_lluvia_ligera': '1U8Clnj-ub65qX5RiuVb928MGJGvLUDY-',
  'amanecer_lluvia': '1GRFUjoe1lV8yOj_f04_xXA-B1rScCkzp',
  'amanecer_nublado_parcial': '1Xmi9084iduw7KotQa_CHQAHPXW0kfTxK',
  'amanecer_nublado': '1Nsmbk5ZfxCgsnjAAXb8cDkajnI4LLtoa',
  'amanecer_nieve': '1jrl3QNGjquK3znKmv7aqzZ9eirbV5XCS',
  
  
  'atardecer_nublado_parcial': '1HhTVJBbrZGMDQrJGW7_a9Wsqs_aqZojm',
  'atardecer_nublado': '1i7FpkNS22Lo2B9gO3PZigCYSqn66c7e8',
  'atardecer': '1vsbL1ecVHapE_i6IFetayLnQE0JKtYQ6',
  
  
  'dia_calor': '1LIjulG9gfJI7gH97rvYsSXlbdQpa25QZ',
  'dia_frio': '1xmZlWh7kUGszRImJY5aOtx4GdPmXFrL6',
  'dia_lluvia_fuerte': '1RZmReM6hkm6E4GSKvx68_1ogXvL_mKz8',
  'dia_lluvia': '1RZmReM6hkm6E4GSKvx68_1ogXvL_mKz8',
  'dia_nublado_con_lluvia': '1RZmReM6hkm6E4GSKvx68_1ogXvL_mKz8',
  'dia_nublado_parcial': '1ANwRMoStv_mdgCoXI9sdC3dsD22hKaBO',
  'dia_nublado': '1ZCofR0LsGBrEpmnt1J7pyIsxfWoRRy8x',
  'dia_soleado': '1Po-6qWC9qfsO_-svdOY6zzoh_suCPLCE',
  'dia_tormenta': '1PD3UhJ0DwPzgGiVPoUCnu7GGbv3Ca9rQ',
  
  
  'noche_aguanieve': '1s0VQzWFLK-B2PNDwnGV0RahObItO_NoP',
  'noche_lluvia': '1Yca47R8c0scCINJjtINcksJc3AL2X_PC',
  'noche_con_nubes': '1QEWLrYWPfzHar7gVEOGZUXO3EOZ4wZRt',
  'noche_nublada': '1WHKUUwDNLFmjhgcPUvkJhpnu3HnX-mqa',
  'noche_tormenta': '102tPkkum3VJBHgYeAvocs3Ac7IJudO9T',
  
  
  'tarde_aguanieve': '1K4_0yLksIGQPxL3m-6A4Q5QOB5OCuXxl',
  'tarde_despejada': '13zDRnNL-y6tywCk7IY3J-OvvZt36MD6E',
  'tarde_lluvia_fuerte': '1Z9h76cUX-KAykP9FttlnUtvYwy6NXWim',
  'tarde_lluvia': '1sojz2uI_eXPeJtWRx-tT2nMuL1B3EYAm',
  'tarde_nublado_parcial': '1IEdBME6kox9zLJx7z_yxzlxWAS8ELgUs',
  'tarde_nublado': '1CUz5vvA5ehTRDgvpRpUNxJc5Emc1as3d',
  'tarde_soleado': '1i2xsSnE92pgbNDNWxl-gbvcWo0I2-Dzn',
  'tarde_tormenta': '1ES-72omJuliBo08CCbK57fZle1-jygX9',
  
  
  'tormenta_viento_fuerte': '19QkReOvxAEaJtVs93wl9RFa1N33REMgZ',
  'nieve': '1n5dfGyPU36LsPrSV1-iOXmdOCFlv9WXd',
  'default': '1WHKUUwDNLFmjhgcPUvkJhpnu3HnX-mqa'
};

function getImageUrl(fileId, size = 1200) {
  
  if (!fileId) {
    console.warn('getImageUrl: No hay fileId');
    return null;
  }
  
  
  const url = `https:
  console.log('URL generada:', url);
  return url;
}

function classifyTimeOfDay(hour) {
  if (hour >= 5 && hour < 8) return 'amanecer';
  if (hour >= 8 && hour < 12) return 'dia';
  if (hour >= 12 && hour < 18) return 'tarde';
  if (hour >= 18 && hour < 20) return 'atardecer';
  return 'noche';
}

function classifyWeatherCondition(weatherDesc, weatherCode, windSpeed, chanceOfRain, precipMM) {
  const desc = (weatherDesc || '').toLowerCase();
  const code = String(weatherCode || '');
  const isStrongWind = windSpeed > 35;
  
  if (desc.includes('tormenta') || desc.includes('thunder') || desc.includes('storm') || code === '127' || code === '128') {
    return isStrongWind ? 'tormenta_viento_fuerte' : 'tormenta';
  }
  if (desc.includes('nieve') || desc.includes('snow') || desc.includes('sleet') || code === '179' || code === '182' || code === '227' || code === '230') {
    return 'nieve';
  }
  if (desc.includes('aguanieve') || desc.includes('sleet')) {
    return 'aguanieve';
  }
  const isRain = desc.includes('lluvia') || desc.includes('rain') || code === '176' || code === '185' || code === '299' || code === '302' || code === '305' || code === '308';
  if (isRain) {
    const isHeavy = (chanceOfRain > 70) || (precipMM > 5);
    return isHeavy ? 'lluvia_fuerte' : 'lluvia';
  }
  if (desc.includes('nublado') || desc.includes('overcast') || desc.includes('cloudy') || code === '119' || code === '122') {
    return 'nublado';
  }
  if (desc.includes('parcialmente') || desc.includes('poco nuboso') || desc.includes('few clouds') || code === '116') {
    return 'nublado_parcial';
  }
  if (isStrongWind) {
    return 'viento_fuerte';
  }
  return 'soleado';
}

function classifyTemperature(feelsLike) {
  if (feelsLike >= 28) return 'calor';
  if (feelsLike <= 15) return 'frio';
  return 'templado';
}

function getImageKey(timeOfDay, condition, hasRainWithNubes = false) {
  if (condition === 'tormenta_viento_fuerte') return 'tormenta_viento_fuerte';
  if (condition === 'nieve') return 'nieve';
  if (condition === 'lluvia' && hasRainWithNubes) {
    return `${timeOfDay}_nublado_con_lluvia`;
  }
  if (timeOfDay === 'noche' && condition === 'nublado_parcial') {
    return 'noche_con_nubes';
  }
  
  const conditionMap = {
    'aguanieve': 'aguanieve',
    'lluvia_fuerte': 'lluvia_fuerte',
    'lluvia': 'lluvia',
    'nublado': 'nublado',
    'nublado_parcial': 'nublado_parcial',
    'soleado': 'soleado',
    'tormenta': 'tormenta',
    'calor': 'calor',
    'frio': 'frio',
    'viento_fuerte': 'viento_fuerte'
  };
  
  const mappedCondition = conditionMap[condition] || condition;
  
  if (timeOfDay === 'amanecer' && mappedCondition === 'nieve') return 'amanecer_nieve';
  if (timeOfDay === 'amanecer' && mappedCondition === 'aguanieve') return 'amanecer_aguanieve';
  if (timeOfDay === 'tarde' && mappedCondition === 'soleado') return 'tarde_soleado';
  if (timeOfDay === 'tarde' && mappedCondition === 'despejado') return 'tarde_despejada';
  
  return `${timeOfDay}_${mappedCondition}`;
}

function selectBackgroundImage(classified) {
  const imageKey = getImageKey(classified.timeOfDay, classified.condition, classified.hasRainWithNubes);
  console.log('Clave de imagen buscada:', imageKey);
  
  let fileId = WEATHER_IMAGES[imageKey];
  if (!fileId) {
    const fallbackKey = `${classified.timeOfDay}_${classified.condition.replace('_fuerte', '').replace('_ligera', '')}`;
    fileId = WEATHER_IMAGES[fallbackKey];
    console.log('Usando fallback:', fallbackKey);
  }
  
  if (!fileId) {
    fileId = WEATHER_IMAGES['default'];
    console.log('Usando imagen por defecto');
  }
  return getImageUrl(fileId, 1200);
}

function updateLooksNavBackground(imageUrl) {
  const looksNav = document.getElementById('looks-nav-bg');
  if (!looksNav) {
    console.warn('No se encontro #looks-nav-bg');
    return;
  }
  
  if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      
      looksNav.style.backgroundImage = `url('${imageUrl}')`;
      
      
      looksNav.classList.remove('default-bg');
      looksNav.classList.remove('fallback-bg');
      
      console.log('Fondo actualizado con imagen');
    };
    img.onerror = () => {
      console.error('Error cargando imagen, usando color de fondo');
      applyFallbackBackground(looksNav);
    };
    img.src = imageUrl;
  } else {
    applyFallbackBackground(looksNav);
  }
}

function applyFallbackBackground(looksNav) {
  looksNav.style.backgroundImage = 'none';
  looksNav.classList.add('fallback-bg');
}



function updateWeatherWidgetUI(classified) {
  console.log('🔄 Actualizando widget con:', classified);
  
  const widget = document.getElementById('weather-widget');
  if (!widget) {
    console.error('❌ No se encontró el widget');
    return;
  }
  
  const temp = Math.round(classified.temperature);
  
  let icon = '🌡️';
  if (classified.condition.includes('lluvia')) icon = '☔';
  else if (classified.condition === 'tormenta') icon = '⛈️';
  else if (classified.condition === 'nieve') icon = '❄️';
  else if (classified.condition === 'soleado' || classified.condition === 'calor') icon = '☀️';
  else if (classified.condition === 'nublado') icon = '☁️';
  else if (classified.condition === 'nublado_parcial') icon = '⛅';
  else if (classified.condition === 'viento_fuerte') icon = '💨';
  
  
  widget.innerHTML = `<span class="weather-icon">${icon}</span><span class="weather-temp">${temp}°C</span>`;
  widget.classList.remove('loading');
  
  console.log(`✅ Widget actualizado: ${icon} ${temp}°C`);
}

async function fetchWeatherData(coords = DEFAULT_COORDS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    
    const url = `https:
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Error obteniendo clima:', error.message);
    return null;
  }
}

 


function classifyWeather(weatherData) {
  if (!weatherData || !weatherData.current_condition) {
    const now = new Date();
    return {
      timeOfDay: classifyTimeOfDay(now.getHours()),
      condition: 'soleado',
      temperature: 22,
      feelsLike: 22,
      weatherDesc: 'Estimado',
      isDefault: true
    };
  }
  
  const current = weatherData.current_condition[0];
  const hourly = weatherData.weather?.[0]?.hourly?.[0] || {};
  const hour = new Date().getHours();
  const weatherDesc = current.weatherDesc?.[0]?.value || '';
  const weatherCode = current.weatherCode;
  const temp = parseFloat(current.temp_C) || 22;
  const feelsLike = parseFloat(current.FeelsLikeC) || temp;
  const windSpeed = parseFloat(current.windspeedKmph) || 0;
  const chanceOfRain = parseFloat(hourly.chanceofrain) || 0;
  const precipMM = parseFloat(hourly.precipMM) || 0;
  const timeOfDay = classifyTimeOfDay(hour);
  let condition = classifyWeatherCondition(weatherDesc, weatherCode, windSpeed, chanceOfRain, precipMM);
  const tempCategory = classifyTemperature(feelsLike);
  
  if (tempCategory === 'calor' && condition === 'soleado') condition = 'calor';
  else if (tempCategory === 'frio' && condition === 'soleado') condition = 'frio';
  
  return {
    timeOfDay, condition, temperature: temp, feelsLike, weatherDesc,
    windSpeed, chanceOfRain, hasRainWithNubes: condition === 'lluvia' && weatherDesc.includes('nublado'),
    isDefault: false
  };
}

async function initWeatherAndBackground() {
  console.log('Inicializando clima y fondo...');
  const widget = document.getElementById('weather-widget');
  if (widget) {
    widget.innerHTML = '<span class="weather-icon">🌡️</span><span class="weather-temp">Cargando...</span>';
    widget.classList.add('loading');
  }
  
  const weatherData = await fetchWeatherData();
  
  if (!weatherData) {
    
    if (weatherRetryCount < MAX_WEATHER_RETRIES) {
      const delay = RETRY_DELAYS[weatherRetryCount] || 30000;
      console.warn(`⚠️ Clima no disponible. Reintentando en ${delay / 1000}s... (intento ${weatherRetryCount + 1}/${MAX_WEATHER_RETRIES})`);
      
      if (widget) {
        widget.innerHTML = `<span class="weather-icon">🔄</span><span class="weather-temp">Reintentando...</span>`;
      }
      
      if (weatherRetryTimer) clearTimeout(weatherRetryTimer);
      weatherRetryTimer = setTimeout(async () => {
        weatherRetryCount++;
        await initWeatherAndBackground();
      }, delay);
    } else {
      
      console.warn('❌ Se agotaron los reintentos de clima. Usando valores estimados.');
      weatherRetryCount = 0;
      weatherRetryTimer = null;
      const classified = classifyWeather(null);
      updateWeatherWidgetUI(classified);
      updateLooksNavBackground(selectBackgroundImage(classified));
      const c = classified.condition;
      currentWeather = {
        weatherType: (c === 'calor' ? 'calor' : (c === 'frio' ? 'frio' : (c.includes('lluvia') || c.includes('tormenta') ? 'lluvioso' : 'templado'))),
        temperature: classified.temperature,
        city: 'Nuevo Laredo'
      };
      
      if (allLooks.length > 0) {
        allLooks = sortLooksByWeather(allLooks);
        looks = [...allLooks];
        renderLooks();
        console.log('🔁 Looks re-ordenados con clima estimado.');
      }
    }
    return;
  }
  
  
  const isRetrySuccess = weatherRetryCount > 0;
  weatherRetryCount = 0;
  if (weatherRetryTimer) { clearTimeout(weatherRetryTimer); weatherRetryTimer = null; }
  
  const classified = classifyWeather(weatherData);
  updateWeatherWidgetUI(classified);
  updateLooksNavBackground(selectBackgroundImage(classified));
  
  const c = classified.condition;
  currentWeather = {
    weatherType: (c === 'calor' ? 'calor' : (c === 'frio' ? 'frio' : (c.includes('lluvia') || c.includes('tormenta') ? 'lluvioso' : 'templado'))),
    temperature: classified.temperature,
    city: 'Nuevo Laredo'
  };
  
  
  if (isRetrySuccess && allLooks.length > 0) {
    allLooks = sortLooksByWeather(allLooks);
    looks = [...allLooks];
    renderLooks();
    console.log('🔁 Looks re-ordenados con clima real tras reintento exitoso.');
  }
  
  console.log('Clima aplicado:', classified.timeOfDay, classified.condition, classified.temperature);
}
  


  


const WEATHER_PRIORITY_SCORES = {
  calor: {
    "look_verano_dama": 100, "look_verano_caballero": 100,
    "look_falda_dama": 95, "look_vestido_dama": 90,
    "look_casual_dama": 80, "look_casual_caballero": 80,
    "look_elegante_dama": 60, "look_elegante_caballero": 60,
    "look_confort_dama": 40, "look_confort_caballero": 40,
    "look_chamarra_dama": 10, "look_chamarra_caballero": 10
  },
  frio: {
    "look_chamarra_dama": 100, "look_chamarra_caballero": 100,
    "look_confort_dama": 95, "look_confort_caballero": 95,
    "look_casual_dama": 70, "look_casual_caballero": 70,
    "look_elegante_dama": 65, "look_elegante_caballero": 65,
    "look_vestido_dama": 50, "look_falda_dama": 40,
    "look_verano_dama": 10, "look_verano_caballero": 10
  },
  templado: {
    "look_casual_dama": 100, "look_casual_caballero": 100,
    "look_elegante_dama": 95, "look_elegante_caballero": 95,
    "look_vestido_dama": 90, "look_falda_dama": 85,
    "look_verano_dama": 70, "look_verano_caballero": 70,
    "look_confort_dama": 60, "look_confort_caballero": 60,
    "look_chamarra_dama": 50, "look_chamarra_caballero": 50
  },
  lluvioso: {
    "look_chamarra_dama": 100, "look_chamarra_caballero": 100,
    "look_confort_dama": 90, "look_confort_caballero": 90,
    "look_casual_dama": 70, "look_casual_caballero": 70,
    "look_elegante_dama": 60, "look_elegante_caballero": 60,
    "look_vestido_dama": 50, "look_falda_dama": 40,
    "look_verano_dama": 20, "look_verano_caballero": 20
  }
};


const LOOKS_CONFIG = [
  { id: "look_casual_dama", name: "👗 Casual", description: "Para tu dia a dia", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Blusas"], keywords: [], excludeKeywords: ["vestir", "formal", "gala"], required: true },
      { type: "piernas", categories: ["Pantalon para Dama"], keywords: [], excludeKeywords: ["formal", "vestir"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["Tenis"], excludeKeywords: ["formal", "tacon", "zapato"], required: true }
    ] },
  { id: "look_elegante_dama", name: "👠 Elegancia Femenina", description: "Para ocasiones especiales", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Blusas"], keywords: ["Vestir"], excludeKeywords: ["casual", "deportivo"], required: true },
      { type: "piernas", categories: ["Pantalon para Dama"], keywords: ["Vestir"], excludeKeywords: ["short", "jeans", "mezclilla"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["Zapatos"], excludeKeywords: ["tenis", "sandalias", "deportivo"], required: true }
    ] },
  { id: "look_verano_dama", name: "☀️ Verano Fresco", description: "Fresco para dias calurosos", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Blusas"], keywords: [], excludeKeywords: ["vestir", "formal", "abrigo"], required: true },
      { type: "piernas", categories: ["Short para Dama"], keywords: [], excludeKeywords: ["formal", "vestir", "pantalon"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["Tenis", "sandalias"], excludeKeywords: ["formal", "tacon"], required: true }
    ] },
  { id: "look_falda_dama", name: "🌸 Luce una Falda", description: "Look fresco con falda", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Blusas"], keywords: [], excludeKeywords: ["deportivo", "abrigo"], required: true },
      { type: "piernas", categories: ["Faldas"], keywords: [], excludeKeywords: ["short", "pantalon"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["Tenis", "sandalias"], excludeKeywords: ["formal", "tacon"], required: true }
    ] },
  { id: "look_vestido_dama", name: "💃 Vestido Elegante", description: "Perfecto para citas", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Vestidos"], keywords: [], excludeKeywords: ["casual", "deportivo"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["tacones"], excludeKeywords: ["tenis", "deportivo", "sandalias"], required: true }
    ] },
  { id: "look_confort_dama", name: "🛋️ Confort en Casa", description: "Comodidad en casa", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Sueter para Dama"], keywords: [], excludeKeywords: ["vestir", "formal"], required: true },
      { type: "piernas", categories: ["Pantalon para Dama"], keywords: ["pants"], excludeKeywords: ["vestir", "formal"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["Pantunflas"], excludeKeywords: ["tenis", "tacon"], required: true }
    ] },
  { id: "look_chamarra_dama", name: "🧥 Abrigate", description: "Ideal para dias frescos", category: "Mujer",
    slots: [
      { type: "torso", categories: ["Chamarra para Dama"], keywords: [], excludeKeywords: ["vestir", "formal"], required: true },
      { type: "piernas", categories: ["Pantalon para Dama"], keywords: ["pants", "pantalon"], excludeKeywords: ["vestir", "formal", "short"], required: true },
      { type: "pies", categories: ["Calzado para Dama"], keywords: ["Pantunflas"], excludeKeywords: ["tenis", "tacon"], required: true }
    ] },
  { id: "look_casual_caballero", name: "👔 Casual Hombre", description: "Para el dia a dia", category: "Hombre",
    slots: [
      { type: "torso", categories: ["Playeras"], keywords: [], excludeKeywords: ["vestir", "formal", "camisa"], required: true },
      { type: "piernas", categories: ["Pantalon para Caballero"], keywords: [], excludeKeywords: ["formal", "vestir", "short"], required: true },
      { type: "pies", categories: ["Calzado para Caballero"], keywords: ["Tenis", "Botas"], excludeKeywords: ["formal", "zapato"], required: true }
    ] },
  { id: "look_elegante_caballero", name: "🤵 Elegancia Masculina", description: "Formal para ocasiones especiales", category: "Hombre",
    slots: [
      { type: "torso", categories: ["Playeras"], keywords: ["Vestir"], excludeKeywords: ["casual", "deportivo"], required: true },
      { type: "piernas", categories: ["Pantalon para Caballero"], keywords: ["Vestir"], excludeKeywords: ["short", "jeans", "mezclilla"], required: true },
      { type: "pies", categories: ["Calzado para Caballero"], keywords: ["Zapatos"], excludeKeywords: ["tenis", "deportivo", "botas"], required: true }
    ] },
  { id: "look_verano_caballero", name: "🏖️ Verano Hombre", description: "Fresco para el calor", category: "Hombre",
    slots: [
      { type: "torso", categories: ["Playeras"], keywords: [], excludeKeywords: ["vestir", "formal", "camisa"], required: true },
      { type: "piernas", categories: ["Short para Caballero"], keywords: [], excludeKeywords: ["formal", "vestir", "pantalon"], required: true },
      { type: "pies", categories: ["Calzado para Caballero"], keywords: ["Tenis", "sandalias"], excludeKeywords: ["formal", "zapato"], required: true }
    ] },
  { id: "look_chamarra_caballero", name: "🧥 Abrigate Hombre", description: "Luce tu chamarra", category: "Hombre",
    slots: [
      { type: "torso", categories: ["Chamarra para Caballero"], keywords: [], excludeKeywords: ["vestir", "formal"], required: true },
      { type: "piernas", categories: ["Pantalon para Caballero"], keywords: ["pants", "pantalon"], excludeKeywords: ["vestir", "formal", "short"], required: true },
      { type: "pies", categories: ["Calzado para Caballero"], keywords: ["Tenis"], excludeKeywords: ["formal", "zapato"], required: true }
    ] },
  { id: "look_confort_caballero", name: "🛋️ Confort Hombre", description: "Comodidad para el hogar", category: "Hombre",
    slots: [
      { type: "torso", categories: ["Sueter para Caballero"], keywords: [], excludeKeywords: ["vestir", "formal"], required: true },
      { type: "piernas", categories: ["Pantalon para Caballero"], keywords: ["pants"], excludeKeywords: ["vestir", "formal", "short"], required: true },
      { type: "pies", categories: ["Calzado para Caballero"], keywords: ["Tenis", "pantunflas"], excludeKeywords: ["formal", "zapato"], required: true }
    ] }
];


function showSkeletonLooks() {
  const container = document.getElementById("looks-container");
  if (!container) return;
  
  const skeletonCards = [];
  const skeletonCount = Math.min(looksPerPage, 6);
  
  for (let i = 0; i < skeletonCount; i++) {
    skeletonCards.push(`
      <div class="look-card skeleton-card">
        <div class="skeleton-images-container">
          <div class="skeleton-image torso shimmer"></div>
          <div class="skeleton-image piernas shimmer"></div>
          <div class="skeleton-image pies shimmer"></div>
        </div>
        <div class="look-info">
          <div class="skeleton-category shimmer"></div>
          <div class="skeleton-title shimmer"></div>
          <div class="skeleton-text shimmer"></div>
          <div class="skeleton-products">
            <div class="skeleton-product shimmer"></div>
            <div class="skeleton-product shimmer"></div>
            <div class="skeleton-product shimmer"></div>
          </div>
          <div class="skeleton-button shimmer"></div>
        </div>
      </div>
    `);
  }
  
  container.innerHTML = skeletonCards.join('');
}

function hideSkeletonLooks() {
  const skeletons = document.querySelectorAll('.skeleton-card');
  skeletons.forEach(s => {
    s.style.opacity = '0';
    setTimeout(() => {
      if (s.parentNode) s.remove();
    }, 200);
  });
}

function initLazyLoading() {
  if ('IntersectionObserver' in window) {
    lazyImageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const dataSrc = img.getAttribute('data-src');
          if (dataSrc) {
            const newImg = new Image();
            newImg.onload = () => {
              img.src = dataSrc;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
            };
            newImg.src = dataSrc;
          }
          lazyImageObserver.unobserve(img);
        }
      });
    }, { rootMargin: '100px 0px', threshold: 0.01 });
  }
}

function initLazyImagesAfterRender() {
  const lazyImages = document.querySelectorAll('.lazy');
  if (lazyImageObserver) {
    lazyImages.forEach(img => lazyImageObserver.observe(img));
  }
}


function compressLooksData(looks) {
  return looks.map(look => ({
    id: look.id,
    name: look.name,
    description: look.description,
    category: look.category,
    productCount: look.productCount,
    products: Object.entries(look.products).reduce((acc, [key, product]) => {
      if (product) {
        acc[key] = {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          stock: product.stock,
          size: product.size
        };
      }
      return acc;
    }, {})
  }));
}

function decompressLooksData(compressed) {
  return compressed.map(look => ({
    ...look,
    config: LOOKS_CONFIG.find(c => c.id.toLowerCase() === look.id),
    products: look.products
  }));
}

function getCachedLooksOptimized() {
  try {
    const sessionCached = sessionStorage.getItem(LOOKS_CACHE_KEY);
    if (sessionCached) {
      const { looks: compressed, timestamp, productsHash } = JSON.parse(sessionCached);
      const currentHash = getProductsQuickHash();
      if (currentHash === productsHash && (Date.now() - timestamp) < 300000) {
        console.log("Looks desde sessionStorage (instantaneo)");
        return decompressLooksData(compressed);
      }
    }
    
    const localCached = localStorage.getItem(LOOKS_CACHE_KEY);
    if (localCached) {
      const { looks: compressed, timestamp, productsHash } = JSON.parse(localCached);
      const currentHash = getProductsQuickHash();
      if (currentHash === productsHash && (Date.now() - timestamp) < 600000) {
        console.log("Looks desde localStorage");
        const decompressed = decompressLooksData(compressed);
        sessionStorage.setItem(LOOKS_CACHE_KEY, JSON.stringify({
          looks: compressed,
          productsHash,
          timestamp: Date.now()
        }));
        return decompressed;
      }
    }
    
    return null;
  } catch(e) {
    console.warn("Error cargando cache de looks:", e);
    return null;
  }
}

function saveLooksToCacheOptimized(looks) {
  try {
    const compressed = compressLooksData(looks);
    const productsHash = getProductsQuickHash();
    const cacheData = {
      looks: compressed,
      productsHash,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem(LOOKS_CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(LOOKS_CACHE_KEY, JSON.stringify(cacheData));
    
    console.log(`Looks guardados en cache`);
  } catch(e) {
    console.warn("Error guardando cache de looks:", e);
  }
}

function getProductsQuickHash() {
  if (!allProducts.length) return 'empty';
  return allProducts.slice(0, 100).map(p => `${p.ID}:${p.Stock}`).join('|');
}


function sortLooksByWeather(looksArray) {
  if (!currentWeather || !currentWeather.weatherType) return looksArray;
  const weatherType = currentWeather.weatherType.toLowerCase();
  const priorityScores = WEATHER_PRIORITY_SCORES[weatherType];
  if (!priorityScores) return looksArray;
  return [...looksArray].sort((a, b) => (priorityScores[b.id?.toLowerCase()] || 0) - (priorityScores[a.id?.toLowerCase()] || 0));
}

function matchesProductCriteria(product, categories, keywords, excludeKeywords = []) {
  if (!product) return false;
  const productCategory = (product.Categoria || "").toLowerCase();
  const matchesCategory = categories.length === 0 || categories.some(cat => cat.toLowerCase() === productCategory);
  if (!matchesCategory) return false;
  const productName = (product.Nombre || "").toLowerCase();
  const parenthesisMatch = productName.match(/\(([^)]+)\)/);
  const textInParenthesis = parenthesisMatch ? parenthesisMatch[1].toLowerCase() : "";
  if (keywords && keywords.length > 0 && keywords[0] !== "") {
    const matchesKeyword = keywords.some(keyword => productName.includes(keyword.toLowerCase()) || textInParenthesis.includes(keyword.toLowerCase()));
    if (!matchesKeyword) return false;
  }
  if (excludeKeywords && excludeKeywords.length > 0) {
    const isExcluded = excludeKeywords.some(exclude => productName.includes(exclude.toLowerCase()) || textInParenthesis.includes(exclude.toLowerCase()));
    if (isExcluded) return false;
  }
  return true;
}

function getProductsForSlot(products, slot) {
  return products.filter(p => {
    if (!p.Stock || p.Stock <= 0 || p.Stock === "0") return false;
    const matchesCategory = slot.categories.length === 0 || slot.categories.includes(p.Categoria);
    if (!matchesCategory) return false;
    const productName = (p.Nombre || "").toLowerCase();
    const parenthesisMatch = productName.match(/\(([^)]+)\)/);
    const textInParenthesis = parenthesisMatch ? parenthesisMatch[1].toLowerCase() : "";
    if (slot.keywords && slot.keywords.length > 0 && slot.keywords[0] !== "") {
      const matchesKeyword = slot.keywords.some(keyword => productName.includes(keyword.toLowerCase()) || textInParenthesis.includes(keyword.toLowerCase()));
      if (!matchesKeyword) return false;
    }
    if (slot.excludeKeywords && slot.excludeKeywords.length > 0) {
      const isExcluded = slot.excludeKeywords.some(exclude => productName.includes(exclude.toLowerCase()) || textInParenthesis.includes(exclude.toLowerCase()));
      if (isExcluded) return false;
    }
    return true;
  });
}

function selectProductsForLook(lookConfig, productsWithImages, currentSelection = {}) {
  const selected = {};
  const usedProductIds = [];
  
  for (const slot of lookConfig.slots) {
    const slotKey = slot.type;
    const currentProductId = currentSelection[slotKey]?.id;
    
    if (currentProductId && !currentSelection._reloading) {
      const existingProduct = productsWithImages.find(p => p.ID == currentProductId);
      if (existingProduct && existingProduct.Stock > 0) {
        selected[slotKey] = {
          id: existingProduct.ID,
          name: existingProduct.Nombre,
          price: Number(existingProduct.Precio || 0),
          image: existingProduct.Imagen1 || existingProduct.Imagen2 || "",
          stock: existingProduct.Stock,
          category: existingProduct.Categoria,
          size: existingProduct.Talla || ""
        };
        usedProductIds.push(String(existingProduct.ID));
        continue;
      }
    }
    
    const availableProducts = getProductsForSlot(productsWithImages, slot);
    const freshProducts = availableProducts.filter(p => !usedProductIds.includes(String(p.ID)));
    
    if (freshProducts.length > 0) {
      const randomIndex = Math.floor(Math.random() * freshProducts.length);
      const product = freshProducts[randomIndex];
      selected[slotKey] = {
        id: product.ID,
        name: product.Nombre,
        price: Number(product.Precio || 0),
        image: product.Imagen1 || product.Imagen2 || "",
        stock: product.Stock,
        category: product.Categoria,
        size: product.Talla ? "Talla: " + product.Talla : "Talla:"
      };
      usedProductIds.push(String(product.ID));
    }
  }
  
  return selected;
}

async function generateLooksProgressive() {
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    const productsWithImages = allProducts.filter(p => 
      (p.Imagen1 || p.Imagen2 || p.Imagen3) && Number(p.Stock || 0) > 0
    );
    
    const allBuiltLooks = [];
    let currentIndex = 0;
    
    function processBatch() {
      const batchSize = 3;
      const end = Math.min(currentIndex + batchSize, LOOKS_CONFIG.length);
      
      for (let i = currentIndex; i < end; i++) {
        const config = LOOKS_CONFIG[i];
        const selectedProducts = selectProductsForLook(config, productsWithImages);
        const productCount = Object.keys(selectedProducts).length;
        
        if (productCount > 0) {
          allBuiltLooks.push({
            id: config.id.toLowerCase(),
            name: config.name,
            description: config.description,
            category: config.category,
            products: selectedProducts,
            config: config,
            productCount: productCount
          });
        }
      }
      
      currentIndex = end;
      
      if (allBuiltLooks.length > 0) {
        const currentLooks = sortLooksByWeather([...allBuiltLooks]);
        allLooks = currentLooks;
        looks = [...allLooks];
        renderLooks();
        initLazyImagesAfterRender();
      }
      
      if (currentIndex < LOOKS_CONFIG.length) {
        setTimeout(processBatch, 50);
      } else {
        
        saveLooksToCacheOptimized(allBuiltLooks);
        allLooks = sortLooksByWeather(allBuiltLooks);
        looks = [...allLooks];
        renderLooks();
        initLazyImagesAfterRender();
        preloadAdjacentPages();
        
        const endTime = performance.now();
        console.log(`Looks generados en ${(endTime - startTime).toFixed(0)}ms`);
        resolve();
      }
    }
    
    processBatch();
  });
}


function preloadAdjacentPages() {
  if (isPreloading) return; 
  isPreloading = true;
  
  const totalPages = Math.ceil(allLooks.length / looksPerPage);
  
  if (currentLooksPage < totalPages) {
    preloadLooksPage(currentLooksPage + 1);
  }
  
  if (currentLooksPage > 1) {
    preloadLooksPage(currentLooksPage - 1);
  }
  
  setTimeout(() => { isPreloading = false; }, 500);
}

function preloadLooksPage(pageNumber) {
  if (preloadedNextPage === pageNumber) return;
  
  const start = (pageNumber - 1) * looksPerPage;
  const end = start + looksPerPage;
  const pageLooks = allLooks.slice(start, end);
  
  if (pageLooks.length === 0) return;
  
  if (window.requestIdleCallback) {
    requestIdleCallback(() => {
      pageLooks.forEach(look => {
        Object.values(look.products).forEach(product => {
          if (product?.image) {
            const imgLink = document.createElement('link');
            imgLink.rel = 'preload';
            imgLink.as = 'image';
            imgLink.href = product.image;
            document.head.appendChild(imgLink);
          }
        });
      });
      
      preloadedNextPage = pageNumber;
      console.log(`Precargada pagina ${pageNumber} de looks`);
    });
  } else {
    setTimeout(() => {
      pageLooks.forEach(look => {
        Object.values(look.products).forEach(product => {
          if (product?.image) {
            const img = new Image();
            img.src = product.image;
          }
        });
      });
      preloadedNextPage = pageNumber;
    }, 100);
  }
}

function createLookCardWithLazy(look) {
  let totalPrice = 0;
  let productsHtml = '';
  let productCount = 0;
  let imagesHtml = '';

  const slotOrder = ["torso", "piernas", "pies"];
  const slotNames = { torso: '👕 Superior', piernas: '👖 Inferior', pies: '👟 Calzado' };

  const safeLookName = escapeHtml(look.name || "Look");
  const safeLookDescription = escapeHtml(look.description || "");
  const safeLookCategory = escapeHtml(look.category || "");

  const wishlistActive = isLookInWishlist(look.id);
  const wishlistHtml = `<button class="look-wishlist-btn ${wishlistActive ? 'active' : ''}" data-look-id="${escapeHtml(look.id)}" data-action="wishlist">${wishlistActive ? '❤️' : '🤍'}</button>`;

  for (const slotKey of slotOrder) {
    const product = look.products[slotKey];
    if (!product) continue;

    productCount++;
    totalPrice += product.price;

    const optimizedImg = optimizeDriveUrl(product.image, 200);
    const optimizedModalImg = optimizeDriveUrl(product.image, 800);
    const slotName = slotNames[slotKey] || slotKey;

    imagesHtml += `
      <div class="look-slot-image" data-slot="${escapeHtml(slotKey)}"
           data-modal-url="${escapeHtml(optimizedModalImg)}"
           data-product-id="${escapeHtml(String(product.id))}">
        <img class="look-slot-img lazy"
             data-src="${escapeHtml(optimizedImg)}"
             src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
             alt="${escapeHtml(product.name)}"
             loading="lazy">
      </div>
    `;

    productsHtml += `
      <div class="look-product-item" data-slot="${escapeHtml(slotKey)}">
        <div class="look-product-info">
          <div class="look-product-name">${escapeHtml(product.name)}</div>
          <div class="look-product-price">${formatCurrency(product.price)}</div>
          <div class="look-product-size">${escapeHtml(product.size || 'Talla no especificada')}</div>
        </div>
        <div class="look-product-actions">
          <button class="look-product-add"
            data-id="${escapeHtml(String(product.id))}"
            data-nombre="${escapeHtml(product.name)}"
            data-precio="${product.price}"
            data-imagen="${escapeHtml(product.image)}"
            data-talla="${escapeHtml(product.size || '')}">🛒</button>
          <button class="look-product-reload"
            data-look-id="${escapeHtml(String(look.id))}"
            data-slot-key="${escapeHtml(slotKey)}"
            title="Cambiar esta prenda">⟳</button>
        </div>
      </div>
    `;
  }

  const card = document.createElement("div");
  card.className = "look-card";

  card.innerHTML = `
    <div class="look-images-container">
      ${imagesHtml || '<div class="look-slot-image empty">Sin imagenes</div>'}
    </div>

    <div class="look-info">
      <div class="look-header">
        <span class="look-category">${safeLookCategory}</span>
        <span class="look-item-count">${productCount} prenda${productCount !== 1 ? 's' : ''}</span>
        ${wishlistHtml}
      </div>

      <h2 class="look-title">${safeLookName}</h2>
      <p class="look-description">${safeLookDescription}</p>

      <div class="look-products">
        <div class="look-products-title"><span>✨ Este outfit incluye:</span></div>
        <div class="look-products-list">${productsHtml}</div>

        <div class="look-total">
          <span class="look-total-label">💰 Precio total:</span>
          <span class="look-total-price">${formatCurrency(totalPrice)}</span>
        </div>
      </div>
      <button class="buy-look-btn" data-look-id="${escapeHtml(String(look.id))}">🛒 Comprar todo</button>
    </div>
  `;

  card.querySelector('[data-action="wishlist"]')?.addEventListener('click', (e) => {
    toggleLookWishlist(look.id, e);
  });

  card.querySelectorAll('.look-slot-image').forEach(div => {
    div.addEventListener('click', () => openImageModal(div.dataset.modalUrl, div.dataset.productId));
  });

  card.querySelectorAll('.look-product-add').forEach(btn => {
    btn.addEventListener('click', () => addToCart({
      ID: btn.dataset.id,
      Nombre: btn.dataset.nombre,
      Precio: Number(btn.dataset.precio),
      Imagen1: btn.dataset.imagen,
      Talla: btn.dataset.talla
    }));
  });

  card.querySelectorAll('.look-product-reload').forEach(btn => {
    btn.addEventListener('click', (e) => reloadSlot(btn.dataset.lookId, btn.dataset.slotKey, e));
  });

  card.querySelector('.buy-look-btn')?.addEventListener('click', () => addLookToCart(look.id));

  return card;
}

function renderLooks() {
  const container = document.getElementById("looks-container");
  if (!container) return;
  
  if (allLooks.length === 0) {
    if (!container.querySelector('.skeleton-card')) {
      container.innerHTML = `<div class="empty-looks"><p>✨ No disponibles en este momento.</p><p>Visita el <a href="index.html" style="color:#ff4f81;">catalogo</a> para ver nuestros productos.</p></div>`;
    }
    renderLooksPagination();
    return;
  }
  
  const totalPages = Math.ceil(allLooks.length / looksPerPage);
  const start = (currentLooksPage - 1) * looksPerPage;
  const end = start + looksPerPage;
  const looksToRender = allLooks.slice(start, end);
  
  const fragment = document.createDocumentFragment();
  
  looksToRender.forEach(look => {
    const card = createLookCardWithLazy(look);
    fragment.appendChild(card);
  });
  
  const existingCards = container.querySelectorAll('.look-card:not(.skeleton-card)');
  existingCards.forEach(card => card.remove());
  
  container.appendChild(fragment);
  
  renderLooksPagination(totalPages);
  preloadAdjacentPages();
}

function renderLooksPagination(totalPages) {
  const container = document.getElementById("looks-container");
  if (!container) return;
  
  const existingPagination = document.querySelector(".looks-pagination");
  if (existingPagination) existingPagination.remove();
  
  if (totalPages <= 1) return;
  
  const paginationDiv = document.createElement("div");
  paginationDiv.className = "looks-pagination admin-pagination";
  paginationDiv.style.cssText = "display: flex; justify-content: center; gap: 8px; margin-top: 20px; flex-wrap: wrap;";
   
  let startPage = Math.max(1, currentLooksPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4 && startPage > 1) startPage = Math.max(1, endPage - 4);
  
  if (currentLooksPage > 1) {
    const prevBtn = createPaginationButton("← Anterior", () => {
      currentLooksPage--;
      renderLooks();
      initLazyImagesAfterRender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    paginationDiv.appendChild(prevBtn);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = createPaginationButton(i.toString(), () => {
      currentLooksPage = i;
      renderLooks();
      initLazyImagesAfterRender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    if (i === currentLooksPage) pageBtn.classList.add("active-page");
    paginationDiv.appendChild(pageBtn);
  }
  
  if (currentLooksPage < totalPages) {
    const nextBtn = createPaginationButton("Siguiente →", () => {
      currentLooksPage++;
      renderLooks();
      initLazyImagesAfterRender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    paginationDiv.appendChild(nextBtn);
  }
  
  container.parentNode.insertBefore(paginationDiv, container.nextSibling);
}

function createPaginationButton(text, onClick) {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.onclick = onClick;
  
  if (text === "Siguiente →" && currentLooksPage < Math.ceil(allLooks.length / looksPerPage)) {
    btn.addEventListener('mouseenter', () => {
      preloadLooksPage(currentLooksPage + 1);
    });
  } else if (text === "← Anterior" && currentLooksPage > 1) {
    btn.addEventListener('mouseenter', () => {
      preloadLooksPage(currentLooksPage - 1);
    });
  }
  
  return btn;
}


window.reloadSlot = async function(lookId, slotType, event) {
  if (event) event.stopPropagation();
  
  const lookIndex = looks.findIndex(l => String(l.id).toLowerCase() === String(lookId).toLowerCase());
  if (lookIndex === -1) return;
  
  const look = looks[lookIndex];
  const lookConfig = LOOKS_CONFIG.find(c => c.id.toLowerCase() === lookId.toLowerCase());
  if (!lookConfig) return;
  
  const slot = lookConfig.slots.find(s => s.type === slotType);
  if (!slot) return;
  
  const currentProduct = look.products[slotType];
  const currentProductId = currentProduct ? String(currentProduct.id) : null;
  
  const productsWithImages = allProducts.filter(p => 
    (p.Imagen1 || p.Imagen2 || p.Imagen3) && p.Stock > 0 && p.Stock !== "0"
  );
  if (productsWithImages.length === 0) return;
  
  const excludedProductIds = [];
  if (currentProductId) excludedProductIds.push(currentProductId);
  for (const [key, product] of Object.entries(look.products)) {
    if (key !== slotType && product && product.id) {
      const productId = String(product.id);
      if (!excludedProductIds.includes(productId)) excludedProductIds.push(productId);
    }
  }
  
  let availableProducts = getProductsForSlot(productsWithImages, slot);
  let freshProducts = availableProducts.filter(p => !excludedProductIds.includes(String(p.ID)));
  
  if (freshProducts.length === 0 && currentProductId) {
    freshProducts = availableProducts.filter(p => String(p.ID) !== currentProductId);
  }
  
  if (freshProducts.length === 0) {
    return;
  }
  
  let randomIndex = Math.floor(Math.random() * freshProducts.length);
  let newProduct = freshProducts[randomIndex];
  
  if (currentProductId && String(newProduct.ID) === currentProductId) {
    const otherProducts = freshProducts.filter(p => String(p.ID) !== currentProductId);
    if (otherProducts.length > 0) newProduct = otherProducts[Math.floor(Math.random() * otherProducts.length)];
  }
  
  const updatedProduct = {
    id: newProduct.ID,
    name: newProduct.Nombre,
    price: Number(newProduct.Precio || 0),
    image: newProduct.Imagen1 || newProduct.Imagen2 || newProduct.Imagen3 || "",
    stock: newProduct.Stock,
    category: newProduct.Categoria,
    size: newProduct.Talla ? "Talla: " + newProduct.Talla : "Talla no especificada"
  };
  
  const oldPrice = look.products[slotType]?.price || 0;
  const priceDifference = updatedProduct.price - oldPrice;
  
  look.products[slotType] = updatedProduct;
  
  looks[lookIndex] = { ...look };
  allLooks = [...looks];
  saveLooksToCacheOptimized(allLooks);
  updateSingleLookInDOM(look, lookIndex, slotType, updatedProduct, priceDifference);
};

function updateSingleLookInDOM(look, lookIndex, changedSlotType, newProduct, priceDifference) {
  const lookCards = document.querySelectorAll('.look-card');
  let targetCard = null;
  
  for (const card of lookCards) {
    const titleEl = card.querySelector('.look-title');
    if (titleEl && titleEl.textContent === look.name) {
      targetCard = card;
      break;
    }
  }
  
  if (!targetCard) {
    renderLooks();
    return;
  }
  
  const slotImageContainer = targetCard.querySelector(`.look-slot-image[data-slot="${changedSlotType}"]`);
  if (slotImageContainer) {
    const slotImg = slotImageContainer.querySelector('.look-slot-img');
    const newImageUrl = optimizeDriveUrl(newProduct.image, 150);
    if (slotImg) {
      slotImg.style.opacity = '0.5';
      const newImg = new Image();
      newImg.onload = () => {
        slotImg.src = newImageUrl;
        slotImg.style.opacity = '1';
        slotImg.classList.add('loaded');
      };
      newImg.src = newImageUrl;
      slotImg.setAttribute('data-src', newImageUrl);
    }
    slotImageContainer.dataset.modalUrl = optimizeDriveUrl(newProduct.image, 800);
slotImageContainer.dataset.productId = newProduct.id;
  }
  
  const productItems = targetCard.querySelectorAll('.look-product-item');
  let targetProductItem = null;
  const slotOrder = ["torso", "piernas", "pies"];
  const slotIndex = slotOrder.indexOf(changedSlotType);
  
  if (productItems[slotIndex]) {
    targetProductItem = productItems[slotIndex];
  } else {
    for (const item of productItems) {
      if (item.getAttribute('data-slot') === changedSlotType) {
        targetProductItem = item;
        break;
      }
    }
  }
  
  if (!targetProductItem) {
    renderLooks();
    return;
  }
  
  const totalPriceEl = targetCard.querySelector('.look-total-price');
  let oldTotalPrice = 0;
  if (totalPriceEl) {
    oldTotalPrice = parseFloat(totalPriceEl.textContent.replace(/[^0-9.-]/g, '')) || 0;
  }
  
  const productImg = targetProductItem.querySelector('.look-product-img');
  const newImageUrl = optimizeDriveUrl(newProduct.image, 150);
  if (productImg) {
    productImg.style.opacity = '0.5';
    const newImg = new Image();
    newImg.onload = () => {
      productImg.src = newImageUrl;
      productImg.style.opacity = '1';
      productImg.classList.add('loaded');
    };
    newImg.src = newImageUrl;
    productImg.setAttribute('data-src', newImageUrl);
  }
  
  const productNameEl = targetProductItem.querySelector('.look-product-name');
  if (productNameEl) productNameEl.textContent = escapeHtml(newProduct.name);
  
  const productPriceEl = targetProductItem.querySelector('.look-product-price');
  if (productPriceEl) {
    productPriceEl.textContent = formatCurrency(newProduct.price);
    productPriceEl.classList.add('price-changed');
    setTimeout(() => productPriceEl.classList.remove('price-changed'), 300);
  }
  
  const productSizeEl = targetProductItem.querySelector('.look-product-size');
  if (productSizeEl) productSizeEl.textContent = escapeHtml(newProduct.size || 'Talla no especificada');
  
  const addBtn = targetProductItem.querySelector('.look-product-add');
  if (addBtn) {
    addBtn.dataset.id     = newProduct.id;
addBtn.dataset.nombre = newProduct.name;
addBtn.dataset.precio = newProduct.price;
addBtn.dataset.imagen = newProduct.image;
addBtn.dataset.talla  = newProduct.size || '';
  }
  
  if (totalPriceEl) {
    const newTotalPrice = oldTotalPrice + priceDifference;
    totalPriceEl.textContent = formatCurrency(newTotalPrice);
    totalPriceEl.classList.add('price-changed');
    setTimeout(() => totalPriceEl.classList.remove('price-changed'), 300);
  }
  
  const buyBtn = targetCard.querySelector('.buy-look-btn');
  if (buyBtn) buyBtn.dataset.lookId = look.id;
}


window.addLookToCart = function(lookId) {
  const look = looks.find(l => l.id.toLowerCase() === lookId.toLowerCase());
  if (!look) return;
  const products = Object.values(look.products).filter(p => p !== null);
  if (products.length === 0) { 
    return; 
  }
  
  products.forEach(product => { 
    if (product.stock > 0) {
      addToCart({ 
        ID: product.id, 
        Nombre: product.name, 
        Precio: product.price, 
        Imagen1: product.image, 
        Talla: product.size 
      });
    }
  });
  
  let lookWishlist = JSON.parse(localStorage.getItem('zr_looks_wishlist') || '[]');
  const wasInWishlist = lookWishlist.includes(lookId);
  if (wasInWishlist) {
    lookWishlist = lookWishlist.filter(id => id !== lookId);
    localStorage.setItem('zr_looks_wishlist', JSON.stringify(lookWishlist));
    updateLookWishlistButtons(lookId, false);
    if (typeof renderWishlistLooks === 'function') renderWishlistLooks();
  }
  
  animateCartAdd();
};

function isLookInWishlist(lookId) {
  const wishlist = JSON.parse(localStorage.getItem('zr_looks_wishlist') || '[]');
  return wishlist.includes(lookId);
}

function updateLookWishlistButtons(lookId, isActive) {
  document.querySelectorAll(`.look-wishlist-btn[data-look-id="${lookId}"]`).forEach(btn => {
    btn.classList.toggle('active', isActive);
    btn.textContent = isActive ? '❤️' : '🤍';
  });
}

function toggleLookWishlist(lookId, event) {
  if (event) event.stopPropagation();
  let wishlist = JSON.parse(localStorage.getItem('zr_looks_wishlist') || '[]');
  const idx = wishlist.indexOf(lookId);
  if (idx >= 0) {
    wishlist.splice(idx, 1);
    showTemporaryMessage('💔 Look eliminado de favoritos', 'info');
  } else {
    wishlist.push(lookId);
    showTemporaryMessage('❤️ Look agregado a favoritos', 'success');
  }
  localStorage.setItem('zr_looks_wishlist', JSON.stringify(wishlist));
  updateLookWishlistButtons(lookId, idx === -1);
  renderWishlistLooks();
  
  const badge = document.getElementById("wishlist-count-looks");
  if (badge) badge.textContent = wishlist.length;
}

function renderWishlistLooks() {
  const container = document.getElementById("wishlist-looks-container");
  if (!container) return;
  const wishlistIds = JSON.parse(localStorage.getItem('zr_looks_wishlist') || '[]');
  const wishlistLooks = allLooks.filter(look => wishlistIds.includes(look.id));
  
  if (wishlistLooks.length === 0) {
    container.innerHTML = '<div class="cart-empty-state"><div class="cart-empty-icon">❤️</div><p class="helper-text">No hay looks guardados</p><p class="cart-empty-hint">❤️ Agrega looks que te gusten</p></div>';
  } else {
    container.innerHTML = '';
    wishlistLooks.forEach(look => {
      const card = createLookCardMini(look);
      container.appendChild(card);
    });
  }
  
  const badge = document.getElementById("wishlist-count-looks");
  if (badge) badge.textContent = wishlistIds.length;
}

function createLookCardMini(look) {
  const div = document.createElement('div');
  div.className = 'cart-item';
  
  let totalPrice = 0;
  let productsList = '';
  
  for (const slot of ['torso', 'piernas', 'pies']) {
    const product = look.products[slot];
    if (product) {
      totalPrice += product.price;
      const productImg = optimizeDriveUrl(product.image, 60);
      productsList += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
          <img src="${escapeHtml(productImg)}" alt="${escapeHtml(product.name)}" 
               style="width: 40px; height: 40px; object-fit: contain; background: #f5f5f8; border-radius: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 12px; font-weight: 500;">${escapeHtml(product.name)}</div>
            <div style="font-size: 11px; color: #ff4f81;">${formatCurrency(product.price)}</div>
            <div style="font-size: 10px; color: #888;">${escapeHtml(product.size || 'Talla no especificada')}</div>
          </div>
        </div>
      `;
    }
  }
  
  div.innerHTML = `
    <div class="cart-item-info" style="flex:1">
      <div class="cart-item-title" style="font-size: 16px; margin-bottom: 8px;">✨ ${escapeHtml(look.name)}</div>
      <div style="margin-bottom: 8px; max-height: 200px; overflow-y: auto;">
        ${productsList}
      </div>
      <div class="cart-item-meta" style="font-weight:bold; color:#ff4f81; margin: 8px 0;">
        Total: ${formatCurrency(totalPrice)}
      </div>
      <div class="cart-item-actions" style="margin-top: 8px; display: flex; gap: 8px;">
        <button class="add-look-to-cart" data-look-id="${look.id}" style="background:#e8e8ff; border:none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px;">🛒 Agregar todo</button>
        <button class="remove-look-from-wishlist" data-look-id="${look.id}" style="background:#ffe8e8; border:none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px;">🗑 Eliminar</button>
      </div>
    </div>
  `;
  
  div.querySelector('.add-look-to-cart')?.addEventListener('click', (e) => {
    e.stopPropagation();
    addLookToCart(look.id);
    showTemporaryMessage(`✅ ${look.name} agregado al carrito`, 'success');
  });
  
  div.querySelector('.remove-look-from-wishlist')?.addEventListener('click', (e) => {
    e.stopPropagation();
    let wishlist = JSON.parse(localStorage.getItem('zr_looks_wishlist') || '[]');
    wishlist = wishlist.filter(id => id !== look.id);
    localStorage.setItem('zr_looks_wishlist', JSON.stringify(wishlist));
    updateLookWishlistButtons(look.id, false);
    renderWishlistLooks();
    
    const badge = document.getElementById("wishlist-count-looks");
    if (badge) badge.textContent = wishlist.length;
    
    showTemporaryMessage('💔 Look eliminado de favoritos', 'info');
  });
  
  return div;
}

function initLooksLayoutToggle() {
  const looksContainer = document.getElementById("looks-container");
  const toggleBtn = document.getElementById("layout-toggle-looks");
  if (!looksContainer || !toggleBtn) return;
  const savedLayout = localStorage.getItem("looks_layout");
  if (savedLayout === "grid") {
    looksContainer.classList.add("layout-grid");
    toggleBtn.textContent = "▦";
  } else {
    toggleBtn.textContent = "≡";
  }
  toggleBtn.addEventListener("click", () => {
    looksContainer.classList.toggle("layout-grid");
    const isGrid = looksContainer.classList.contains("layout-grid");
    localStorage.setItem("looks_layout", isGrid ? "grid" : "list");
    toggleBtn.textContent = isGrid ? "▦" : "≡";
  });
}


let isBackgroundServicesStarted = false;
let isLoadingProducts = false;

async function loadProducts() {
  if (isLoadingProducts) {
    console.log("Carga de productos ya en progreso, omitiendo...");
    return;
  }
  
  isLoadingProducts = true;
  showSkeletonLooks();

  if (!navigator.onLine) {
    console.log('Offline - Cargando looks desde cache');
    if (window.ConnectionMonitor?.showOfflineBanner) {
      window.ConnectionMonitor.showOfflineBanner();
    }
  }
  
  const ensureProductIndex = (products) => {
    if (!products?.length) return false;
    
    if (typeof window.buildProductIndex === "function") {
      window.buildProductIndex(products);
      return true;
    } else if (typeof buildProductIndex === "function") {
      buildProductIndex(products);
      return true;
    }
    return false;
  };

  const getCachedProductsUnified = () => {
    return window.CacheManager?.getSessionProductsCache?.() || getCachedProducts() || [];
  };

  const restoreScrollPosition = () => {
    const savedScroll = sessionStorage.getItem("looks_scroll_position");
    if (savedScroll) {
      setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 100);
      sessionStorage.removeItem("looks_scroll_position");
    }
  };

  const renderInitialLooks = () => {
    setTimeout(() => {
      renderLooks();
      initLazyImagesAfterRender();
      preloadAdjacentPages();
      hideSkeletonLooks();
    }, 50);
  };

  const startBackgroundServices = () => {
    if (isBackgroundServicesStarted) {
      console.log("Servicios background ya iniciados previamente");
      return;
    }
    
    isBackgroundServicesStarted = true;
    console.log("Iniciando servicios en background...");
    
    if (navigator.onLine && !isGeneratingLooks && typeof loadFreshProductsInBackground === "function") {
      loadFreshProductsInBackground();
    }
  };

  await initWeatherAndBackground();

  const cachedLooks = getCachedLooksOptimized();
  
  if (cachedLooks?.length > 0) {
    console.log("LOOKS DESDE CACHE - INSTANTANEO");

    
    allLooks = sortLooksByWeather(cachedLooks);
    looks = [...allLooks];
    currentLooksPage = 1;

    const cachedProducts = getCachedProductsUnified();
    if (cachedProducts.length > 0) {
      allProducts = cachedProducts;
      ensureProductIndex(allProducts);
    }

    renderInitialLooks();
    restoreScrollPosition();
    startBackgroundServices();

    isLoadingProducts = false;
    return;
  }

  const cachedProducts = getCachedProductsUnified();
  
  if (cachedProducts.length > 0) {
    console.log("Productos desde cache, generando looks progresivamente...");

    allProducts = cachedProducts;
    ensureProductIndex(allProducts);

    await generateLooksProgressive();
    hideSkeletonLooks();
    restoreScrollPosition();
    startBackgroundServices();

    isLoadingProducts = false;
    return;
  }

  try {
    console.log("Cargando productos desde red...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await res.json();
    allProducts = data.products || data || [];
    setCachedProducts(allProducts);
    ensureProductIndex(allProducts);
    await generateLooksProgressive();
    hideSkeletonLooks();
    startBackgroundServices();

  } catch (err) {
    console.error("Error cargando productos:", err);
    const container = document.getElementById("looks-container");
    if (container && !container.querySelector(".look-card")) {
      container.innerHTML = `
        <div class="empty-looks">
          <p>Error al cargar los productos.</p>
          <p>Verifica tu conexion a internet e <a href="#" onclick="location.reload()">intenta nuevamente</a>.</p>
        </div>
      `;
    }

    hideSkeletonLooks();
  } finally {
    isLoadingProducts = false;
  }
}

async function loadFreshProductsInBackground() {
  if (isGeneratingLooks) return;
  isGeneratingLooks = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await res.json();
    const freshProducts = data.products || data || [];

    
    bgProductsRetryCount = 0;
    if (bgProductsRetryTimer) { clearTimeout(bgProductsRetryTimer); bgProductsRetryTimer = null; }

    if (JSON.stringify(freshProducts) !== JSON.stringify(allProducts)) {
      allProducts = freshProducts;
      setCachedProducts(allProducts);
      await generateLooksProgressive();
      console.log('✅ Productos actualizados en background.');
    } else {
      console.log('ℹ️ Productos en background sin cambios.');
    }

  } catch (err) {
    console.warn(`⚠️ Background productos falló: ${err.message}`);

    if (bgProductsRetryCount < MAX_BG_PRODUCTS_RETRIES) {
      const delay = BG_PRODUCTS_RETRY_DELAYS[bgProductsRetryCount] || 30000;
      console.log(`🔄 Reintentando productos en background en ${delay / 1000}s... (intento ${bgProductsRetryCount + 1}/${MAX_BG_PRODUCTS_RETRIES})`);
      if (bgProductsRetryTimer) clearTimeout(bgProductsRetryTimer);
      bgProductsRetryTimer = setTimeout(() => {
        bgProductsRetryCount++;
        isGeneratingLooks = false; 
        loadFreshProductsInBackground();
      }, delay);
      return; 
    } else {
      console.warn('❌ Se agotaron los reintentos de productos en background.');
      bgProductsRetryCount = 0;
      bgProductsRetryTimer = null;
    }
  } finally {
    isGeneratingLooks = false;
  }
}


document.addEventListener("DOMContentLoaded", () => {
  initLazyLoading();
  loadProducts();
  
  const refreshBtn = document.getElementById("refresh-looks");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      localStorage.removeItem(LOOKS_CACHE_KEY);
      sessionStorage.removeItem(LOOKS_CACHE_KEY);
      loadProducts();
    });
  }
  
  initLooksLayoutToggle();
  window.addEventListener('cartUpdated', () => updateCartBadge());
  
  const requestBtn = document.getElementById("request-purchase-btn");
  if (requestBtn) requestBtn.addEventListener("click", openWhatsAppCheckout);
});


window.reloadSlot = reloadSlot;
window.addLookToCart = addLookToCart;
window.toggleLookWishlist = toggleLookWishlist;
window.renderWishlistLooks = renderWishlistLooks;