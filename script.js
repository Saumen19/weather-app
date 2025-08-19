document.addEventListener('DOMContentLoaded', function() {
    // API configuration - REMEMBER TO REPLACE WITH YOUR OWN API KEY
    const apiKey = 'Set_your_own_api'; // Get from https://home.openweathermap.org/api_keys
    const baseUrl = 'https://api.openweathermap.org/data/2.5';
    
    // Cache configuration
    let lastFetchTime = 0;
    const cacheDuration = 10 * 60 * 1000; // 10 minutes cache
    let weatherCache = {};
    
    // DOM elements
    const cityInput = document.getElementById('city-input');
    const searchBtn = document.getElementById('search-btn');
    const locationBtn = document.getElementById('location-btn');
    const currentCity = document.getElementById('current-city');
    const currentTemp = document.getElementById('current-temp');
    const currentDesc = document.getElementById('current-desc');
    const currentIcon = document.getElementById('current-icon');
    const feelsLike = document.getElementById('feels-like');
    const humidity = document.getElementById('humidity');
    const wind = document.getElementById('wind');
    const pressure = document.getElementById('pressure');
    const forecastContainer = document.getElementById('forecast-container');
    const errorMessage = document.getElementById('error-message');
    
    // Event listeners
    searchBtn.addEventListener('click', searchWeather);
    locationBtn.addEventListener('click', getLocationWeather);
    cityInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchWeather();
    });
    
    // Initial load - default city (Delhi)
    fetchWeather('Delhi', 'IN');
    
    function searchWeather() {
        const city = cityInput.value.trim();
        if (city) {
            fetchWeather(city, 'IN');
        } else {
            showError('Please enter a city name');
        }
    }
    
    function getLocationWeather() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeatherByCoords(lat, lon);
                },
                error => {
                    showError('Geolocation error: ' + error.message);
                }
            );
        } else {
            showError('Geolocation is not supported by your browser');
        }
    }
    
    async function fetchWithCache(url) {
        const now = Date.now();
        
        // Check cache first
        if (weatherCache[url] && (now - weatherCache[url].timestamp < cacheDuration)) {
            return weatherCache[url].data;
        }
        
        // Rate limiting
        const timeSinceLastFetch = now - lastFetchTime;
        if (timeSinceLastFetch < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastFetch));
        }
        
        try {
            lastFetchTime = Date.now();
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'API request failed');
            }
            
            const data = await response.json();
            weatherCache[url] = { data, timestamp: now };
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(`Weather data unavailable: ${error.message}`);
        }
    }
    
    async function fetchWeather(city, country) {
        try {
            showLoading();
            
            const currentUrl = `${baseUrl}/weather?q=${encodeURIComponent(city)},${country}&units=metric&appid=${apiKey}`;
            const forecastUrl = `${baseUrl}/forecast?q=${encodeURIComponent(city)},${country}&units=metric&appid=${apiKey}`;
            
            const [currentData, forecastData] = await Promise.all([
                fetchWithCache(currentUrl).catch(() => null),
                fetchWithCache(forecastUrl).catch(() => null)
            ]);
            
            if (!currentData || !forecastData) {
                throw new Error('Could not fetch weather data');
            }
            
            displayWeather(currentData, forecastData);
            errorMessage.style.display = 'none';
        } catch (error) {
            showError(error.message);
        }
    }
    
    async function fetchWeatherByCoords(lat, lon) {
        try {
            showLoading();
            
            const currentUrl = `${baseUrl}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            const forecastUrl = `${baseUrl}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            
            const [currentData, forecastData] = await Promise.all([
                fetchWithCache(currentUrl),
                fetchWithCache(forecastUrl)
            ]);
            
            if (currentData.sys.country !== 'IN') {
                throw new Error('Please use this feature within India');
            }
            
            displayWeather(currentData, forecastData);
            errorMessage.style.display = 'none';
        } catch (error) {
            showError(error.message);
        }
    }
    
    function displayWeather(currentData, forecastData) {
        // Current weather
        currentCity.textContent = `${currentData.name}, ${currentData.sys.country}`;
        currentTemp.textContent = `${Math.round(currentData.main.temp)}°C`;
        currentDesc.textContent = currentData.weather[0].description;
        currentIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${currentData.weather[0].icon}@2x.png" alt="${currentData.weather[0].description}">`;
        
        feelsLike.textContent = `${Math.round(currentData.main.feels_like)}°C`;
        humidity.textContent = `${currentData.main.humidity}%`;
        wind.textContent = `${currentData.wind.speed} m/s`;
        pressure.textContent = `${currentData.main.pressure} hPa`;
        
        // 5-day forecast
        forecastContainer.innerHTML = '';
        
        // Group forecast by day
        const dailyForecast = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dateKey = date.toLocaleDateString('en-IN');
            
            if (!dailyForecast[dateKey]) {
                dailyForecast[dateKey] = {
                    date: date,
                    temps: [],
                    weather: item.weather[0],
                    dt_txt: item.dt_txt
                };
            }
            dailyForecast[dateKey].temps.push(item.main.temp);
        });
        
        // Get next 5 days
        const forecastDays = Object.values(dailyForecast).slice(0, 5);
        
        forecastDays.forEach(day => {
            const dayName = day.date.toLocaleDateString('en-IN', { weekday: 'short' });
            const dateStr = day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const maxTemp = Math.round(Math.max(...day.temps));
            const minTemp = Math.round(Math.min(...day.temps));
            
            const forecastCard = document.createElement('div');
            forecastCard.className = 'weather-card forecast-card';
            forecastCard.innerHTML = `
                <h3>${dayName}, ${dateStr}</h3>
                <div class="forecast-icon">
                    <img src="https://openweathermap.org/img/wn/${day.weather.icon}.png" alt="${day.weather.description}">
                </div>
                <p>${day.weather.description}</p>
                <div class="forecast-temp">
                    <span class="max-temp">${maxTemp}°</span>
                    <span class="min-temp">${minTemp}°</span>
                </div>
            `;
            forecastContainer.appendChild(forecastCard);
        });
    }
    
    function showLoading() {
        currentCity.textContent = "Loading...";
        currentTemp.textContent = "--";
        currentDesc.textContent = "--";
        currentIcon.innerHTML = "";
        forecastContainer.innerHTML = "<p>Loading forecast...</p>";
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => errorMessage.style.display = 'none', 5000);
    }

});
