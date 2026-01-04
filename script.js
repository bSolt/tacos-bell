let map;
let geocoder;
let infoWindow;
let markers = [];
let filteredPlaces;
let checkedPlaces;
let routePolyline;

async function initMap() {
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  const { Place } = await google.maps.importLibrary("places");
  const { Geocoder } = await google.maps.importLibrary("geocoding");

  map = new Map(document.getElementById("map"), {
    center: { lat: 39.7279232, lng: -104.972288 },
    zoom: 12,
    mapId: "DEMO_MAP_ID",
    gestureHandling: "greedy",
  });

  geocoder = new Geocoder();
  infoWindow = new InfoWindow();

  document.getElementById("search-button").addEventListener("click", performSearch);
  document.getElementById("location-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      performSearch();
    }
  });
  document.getElementById("clear-results-btn").addEventListener("click", clearResults);
  document.getElementById('calculate-route-button').addEventListener("click", calculateBestRoute);
}

async function performSearch() {
  const query = document.getElementById("query-input").value;
  const location = document.getElementById("location-input").value;
  const messageBox = document.getElementById("message-box");

  clearResults();

  if (!location) {
    messageBox.textContent = "Please enter a location.";
    messageBox.style.display = "block";
    return;
  }
  if (!query) {
    messageBox.textContent = "Please enter what you are looking for.";
    messageBox.style.display = "block";
    return;
  }

  messageBox.textContent = "Searching...";
  messageBox.style.display = "block";

  try {
    const geocodeResults = await geocoder.geocode({ address: location, language: 'en' });
    if (geocodeResults.results && geocodeResults.results.length > 0) {
      const geocodeResult = geocodeResults.results[0]
      const localityName = geocodeResult.address_components
        .find(component => component.types.includes("locality")
        )?.long_name;
      const countyName = geocodeResult.address_components
        .find(component => component.types.includes("administrative_area_level_2")
        )?.long_name;
      const matchFields = [];
      if (document.getElementById("city-match").checked && localityName) {
        matchFields.push(["locality", localityName]);
      }
      if (document.getElementById("county-match").checked && countyName) {
        matchFields.push(["administrative_area_level_2", countyName]);
      }
      const viewport = geocodeResult.geometry.viewport;
      map.fitBounds(viewport);

      const { Place } = await google.maps.importLibrary("places");

      const request = {
        textQuery: query,
        fields: ["displayName", "location", "formattedAddress", "addressComponents"],
        locationRestriction: viewport
      };
      let { places } = await Place.searchByText(request)

      if (places.length == 20) {
        // Search by quadrant if there are more than 20 places (max)
        const quads = await getViewportQuadrants(viewport)
        const promises = quads.map((quad) =>
          Place.searchByText({
            ...request,
            locationRestriction: quad
          })
        );
        const results = await Promise.all(promises);
        places = results.flatMap(result => result.places);
      }

      filteredPlaces = places.filter(
        (place) => matchFields.every(
          ([matchType, matchValue]) => place.addressComponents.some(
            (component) =>
              component.types.includes(matchType) && component.longText.includes(matchValue)
          )
        )
      );
      checkedPlaces = new Set(filteredPlaces.map(place => place.id));

      // console.log(places.map(p => p.addressComponents.map(c => [c.longText, c.types])), matchFields, filteredPlaces)


      if (filteredPlaces.length) {
        messageBox.style.display = "none";
        displayResults(query, location, filteredPlaces);
        document.getElementById('route-box').classList.remove("hidden");
      } else {
        messageBox.textContent = "No results found in the specified area.";
      }
    } else {
      messageBox.textContent = "Could not find the specified location.";
    }
  } catch (error) {
    console.error("Search failed:", error);
    messageBox.textContent = "An error occurred during the search.";
  }
}

async function getViewportQuadrants(viewport) {
  const { LatLngBounds } = await google.maps.importLibrary("core")
  // split one bounds into quadrants
  const north = viewport.getNorthEast().lat();
  const east = viewport.getNorthEast().lng();
  const south = viewport.getSouthWest().lat();
  const west = viewport.getSouthWest().lng();
  const midLat = viewport.getCenter().lat();
  const midLng = viewport.getCenter().lng();

  return [
    new LatLngBounds({ north, east, south: midLat, west: midLng }),
    new LatLngBounds({ north, east: midLng, south: midLat, west }),
    new LatLngBounds({ north: midLat, east: midLng, south, west }),
    new LatLngBounds({ north: midLat, east, south, west: midLng }),
  ]

}

function clearResults() {
  markers.forEach((marker) => {
    marker.map = null;
  });
  markers = [];
  document.getElementById("search-form").classList.remove("hidden");
  document.getElementById("results-panel").classList.add("hidden");
  document.getElementById("route-box").classList.add("hidden");
  document.getElementById("results-list").innerHTML = "";
  document.getElementById('route-info').innerHTML = "";
  document.getElementById("message-box").style.display = "none";
  infoWindow.close();
  if (routePolyline) {
    routePolyline.setMap(null);
  }
}

function displayResults(query, location, places) {
  document.getElementById("results-panel").classList.remove("hidden");
  document.getElementById('search-form').classList.add("hidden");
  const resultsList = document.getElementById("results-list");
  const resultSummary = document.getElementById("results-summary");
  const bounds = new google.maps.LatLngBounds();

  resultSummary.innerHTML = `
  <h2>
    Found ${places.length} ${query} locations
  </h2>
  <h3>
    In ${location}
  </h3>
  `

  places.forEach((place) => {
    bounds.extend(place.location);
  });
  places.forEach(async (place) => {
    const marker = await createMarker(place);
    resultsList.appendChild(createNewResult(place, marker));
  });


  if (places.length > 1) {
    map.fitBounds(bounds);
  } else if (places.length === 1) {
    map.setCenter(places[0].location);
    map.setZoom(15);
  }
}

function createNewResult(place, marker) {
  const listItem = document.createElement("li");
  listItem.classList.add("flex");
  listItem.innerHTML = `
      <div>
        <div class="place-name">${place.displayName}</div>
        <div class="place-address">${place.formattedAddress}</div>
      </div>
    `;
  const checkbox = document.createElement("input");
  checkbox.setAttribute("type", "checkbox");
  checkbox.id = `place-checkbox-${place.id})`;
  checkbox.checked = true;
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    if (checkbox.checked) {
      checkedPlaces.add(place.id);
      marker.setMap(map);
    } else {
      marker.setMap(null);
      checkedPlaces.delete(place.id);
    }
  });
  listItem.prepend(checkbox)
  listItem.addEventListener("click", () => {
    if (!checkbox.checked) return;
    google.maps.event.trigger(marker, "click");
  });
  return listItem;
}

async function createMarker(place) {
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  const marker = new AdvancedMarkerElement({
    map,
    position: place.location,
    title: place.displayName,
  });

  marker.addListener("click", () => {
    infoWindow.setContent(`
      <div><strong>${place.displayName}</strong></div>
      <div>${place.formattedAddress}</div>
    `);
    infoWindow.open(map, marker);
    map.panTo(place.location);
  });

  markers.push(marker);
  return marker;
}

async function calculateBestRoute() {
  const selectedPlaces = filteredPlaces.filter((place) => checkedPlaces.has(place.id));
  // console.log('calculating route for', checkedPlaces, selectedPlaces, selectedPlaces.map(p => p.location))
  if (selectedPlaces.length < 2) {
    const message = 'Need at least 2 locations to calculate a route.';
    console.warn(message);
    const routeInfoDiv = document.getElementById('route-info');
    routeInfoDiv.innerHTML = message;
    routeInfoDiv.classList.remove('hidden');
    return;
  }

  if (routePolyline) {
    routePolyline.setMap(null);
  }

  const { Route } = await google.maps.importLibrary("routes");

  const waypoints = selectedPlaces.map(place => ({ location: place.location }));
  const origin = waypoints.shift();

  const request = {
    origin: origin,
    destination: origin,
    intermediates: waypoints,
    travelMode: 'BICYCLING',
    optimizeWaypointOrder: true,
    fields: ['path', 'legs', 'viewport', 'localizedValues', 'warnings', 'distanceMeters', 'durationMillis', 'optimizedIntermediateWaypointIndices']
  };

  try {
    const { routes } = await Route.computeRoutes(request);
    if (routes && routes.length > 0) {
      const route = routes[0];
      // console.log("best route", route, route.localizedValues);
      [routePolyline] = route.createPolylines({
        polylineOptions: {
          map: map,
          strokeColor: '#1a73e8',
          strokeWeight: 6,
          strokeOpacity: 0.8,
        },
      });

      const routeInfoDiv = document.getElementById('route-info');
      const distance = route.localizedValues?.distance || 'N/A';
      const duration = route.localizedValues?.duration || 'N/A';
      routeInfoDiv.innerHTML = `<strong>Best Route:</strong> ${distance} / ${duration}`;
      routeInfoDiv.classList.remove('hidden');

      map.fitBounds(route.viewport);
    } else {
      throw new Error('No routes found.');
    }
  } catch (error) {
    console.error("Route calculation failed:", error);
    const message = 'Could not calculate a route. ' + error;
    console.error(message);
    const routeInfoDiv = document.getElementById('route-info');
    routeInfoDiv.innerHTML = message;
    routeInfoDiv.classList.remove('hidden');
  }
}

initMap();