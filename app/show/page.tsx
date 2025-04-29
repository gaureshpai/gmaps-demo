'use client';
import { getAllData } from '@/backend/db';
import { Demo } from '@/generated/prisma';
import React, { useState, useEffect, useRef } from 'react';

// Define the Demo type to match your database model

const PropertyMapPage: React.FC = () => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [properties, setProperties] = useState<Demo[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Demo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredProperty, setHoveredProperty] = useState<Demo | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{x: number, y: number} | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Fetch data from the API
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const data = await getAllData();
        setFilteredProperties(data);
        setProperties(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching properties:', err);
        setError('Failed to load properties data');
        setIsLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Load Google Maps script with API key
  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps API key is required");
      return;
    }

    if (window.google && window.google.maps) {
      setIsGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.id = 'google-maps-script';

    script.onload = () => {
      setIsGoogleLoaded(true);
    };

    script.onerror = () => {
      setError("Failed to load Google Maps. Please check your API key.");
    };

    document.head.appendChild(script);

    return () => {
      const loadedScript = document.getElementById('google-maps-script');
      if (loadedScript) {
        document.head.removeChild(loadedScript);
      }
    };
  }, [apiKey]);

  // Initialize map when Google Maps is loaded and properties are fetched
  useEffect(() => {
    if (!isGoogleLoaded || !mapRef.current || isLoading || properties.length === 0) return;

    try {
      // Find center of all properties for initial map view
      const validProperties = properties.filter(
        prop => prop.latitude !== null && prop.longitude !== null
      );
      
      if (validProperties.length === 0) {
        setError("No valid property coordinates found");
        return;
      }

      // Calculate center
      const sumLat = validProperties.reduce((sum, prop) => sum + (prop.latitude || 0), 0);
      const sumLng = validProperties.reduce((sum, prop) => sum + (prop.longitude || 0), 0);
      const center = {
        lat: sumLat / validProperties.length,
        lng: sumLng / validProperties.length
      };

      const mapOptions: google.maps.MapOptions = {
        center: center,
        zoom: 10,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);
      googleMapRef.current = map;

      // Clear any existing markers
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
      }

      // Add markers for each property
      validProperties.forEach((property) => {
        if (property.latitude && property.longitude) {
          // Create a custom marker
          const markerIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#3B82F6', // blue-500
            fillOpacity: 0.8,
            strokeColor: '#1E40AF', // blue-800
            strokeWeight: 1,
            scale: 10, // size of the circle
          };

          const marker = new google.maps.Marker({
            position: { lat: property.latitude, lng: property.longitude },
            map: map,
            title: `Property #${property.id}`,
            icon: markerIcon,
            zIndex: 1
          });

          // Store property data with the marker
          const markerWithData = Object.assign(marker, { propertyData: property });
          markersRef.current.push(marker);

          // Add hover event to show custom tooltip
          marker.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
            setHoveredProperty(property);
            
            // Get pixel position for the tooltip
            if (e.domEvent && googleMapRef.current) {
              const projection = googleMapRef.current.getProjection();
              if (projection && e.latLng) {
                const position = projection.fromLatLngToPoint(e.latLng);
                const scale = Math.pow(2, googleMapRef.current.getZoom() || 0);
                const pixelPosition = {
                  x: (position!.x * scale) + window.scrollX,
                  y: (position!.y * scale) + window.scrollY
                };
                setTooltipPosition({
                  x: (e.domEvent as MouseEvent).pageX,
                  y: (e.domEvent as MouseEvent).pageY
                });
              }
            }
          });

          marker.addListener('mouseout', () => {
            setHoveredProperty(null);
            setTooltipPosition(null);
          });

          // Add click event to show more details
          marker.addListener('click', () => {
            // You can add functionality to show more details when clicked
            alert(`Property Details:\nID: ${property.id}\nBroker: ${property.broker}\nPrice: $${property.price?.toLocaleString()}\nAcres: ${property.acres}`);
          });
        }
      });

      // Create bounds to fit all markers
      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach(marker => bounds.extend(marker.getPosition() as google.maps.LatLng));
      map.fitBounds(bounds);

      // Adjust zoom if too zoomed in
      const listener = google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() && map.getZoom()! > 15) {
          map.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });

    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize Google Maps');
    }
  }, [isGoogleLoaded, isLoading, properties]);

  // Format price with proper currency formatting
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `$${price.toLocaleString()}`;
  };

  // Format acres with proper number formatting
  const formatAcres = (acres: number | null) => {
    if (acres === null) return 'N/A';
    return `${acres.toLocaleString()} acres`;
  };

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg border border-red-200">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-100">
      <div className="p-4 bg-white shadow-md">
        <h1 className="text-2xl font-bold text-gray-800">Property Map</h1>
        <p className="text-gray-600">Displaying {properties.length} properties</p>
      </div>

      <div className="relative w-full h-[calc(100vh-100px)]">
        {isLoading || !isGoogleLoaded ? (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            <p className="ml-4 text-lg text-gray-700">
              {isLoading ? 'Loading property data...' : 'Loading Google Maps...'}
            </p>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full"></div>
        )}

        {/* Custom tooltip */}
        {hoveredProperty && tooltipPosition && (
          <div
            ref={tooltipRef}
            className="fixed z-10 bg-white shadow-lg rounded-md p-3 w-64 pointer-events-none"
            style={{
              left: `${tooltipPosition.x + 10}px`,
              top: `${tooltipPosition.y + 10}px`,
            }}
          >
            <div className="font-bold text-blue-700">Property #{hoveredProperty.id}</div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-gray-600">
              <div className="text-gray-600">Broker:</div>
              <div className="font-medium">{hoveredProperty.broker || 'N/A'}</div>
              
              <div className="text-gray-600">Price:</div>
              <div className="font-medium">{formatPrice(hoveredProperty.price)}</div>
              
              <div className="text-gray-600">Size:</div>
              <div className="font-medium">{formatAcres(hoveredProperty.acres)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Property list sidebar - optional */}
      <div className="fixed top-20 right-4 w-72 bg-white shadow-lg rounded-lg p-4 max-h-[calc(100vh-120px)] overflow-auto">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Property List</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Search properties"
            className="w-full p-2 border border-gray-300 rounded-md text-black placeholder:text-gray-600"
            onChange={a => setFilteredProperties(properties.filter(e=>e.city.toLowerCase().includes(a.target.value.toLowerCase())))}
          />

              
          {filteredProperties.map(property => (

            <div 
              key={property.id}
              className="p-3 bg-gray-50 rounded-md hover:bg-blue-50 cursor-pointer border border-gray-200"
              onClick={() => {
                if (googleMapRef.current && property.latitude && property.longitude) {
                  googleMapRef.current.setCenter({ lat: property.latitude, lng: property.longitude });
                  googleMapRef.current.setZoom(16);
                }
              }}
            >
              <div className="font-medium text-blue-700">Property #{property.id}</div>
              <div className="text-sm text-black">
                <div>Broker: {property.broker || 'N/A'}</div>
                <div>Price: {formatPrice(property.price)}</div>
                <div>Size: {formatAcres(property.acres)}</div>
                <div>City: {property.city}</div>
              </div>
            </div>
          ))}
          
        </div>
      </div>
    </div>
  );
};

export default PropertyMapPage;