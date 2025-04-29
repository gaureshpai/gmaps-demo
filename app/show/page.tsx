'use client';

import { getAllData } from '@/backend/db';
import { Demo } from '@prisma/client';
import React, { useState, useEffect, useRef } from 'react';

const PropertyMapPage: React.FC = () => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [properties, setProperties] = useState<Demo[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Demo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredProperty, setHoveredProperty] = useState<Demo | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number, y: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isGoogleLoaded || !mapRef.current || isLoading || properties.length === 0) return;

    try {
      const validProperties = properties.filter(
        prop => prop.latitude !== null && prop.longitude !== null
      );

      if (validProperties.length === 0) {
        setError("No valid property coordinates found");
        return;
      }

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
        styles: [
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [
              { color: "#e9e9e9" },
              { lightness: 17 }
            ]
          },
          {
            featureType: "landscape",
            elementType: "geometry",
            stylers: [
              { color: "#f5f5f5" },
              { lightness: 20 }
            ]
          },
          {
            featureType: "road.highway",
            elementType: "geometry.fill",
            stylers: [
              { color: "#ffffff" },
              { lightness: 17 }
            ]
          }
        ]
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);
      googleMapRef.current = map;

      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
      }

      validProperties.forEach((property) => {
        if (property.latitude && property.longitude) {
          const markerIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#6366F1', // Indigo color
            fillOpacity: 0.9,
            strokeColor: '#4338CA',
            strokeWeight: 1.5,
            scale: 10,
          };

          const marker = new google.maps.Marker({
            position: { lat: property.latitude, lng: property.longitude },
            map: map,
            title: `Property #${property.id}`,
            icon: markerIcon,
            zIndex: 1,
            animation: google.maps.Animation.DROP
          });

          const markerWithData = Object.assign(marker, { propertyData: property });
          markersRef.current.push(marker);

          marker.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
            setHoveredProperty(property);

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

          marker.addListener('click', () => {
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <div class="font-bold text-indigo-700">Property #${property.id}</div>
                  <div>Broker: ${property.broker || 'N/A'}</div>
                  <div>Price: $${property.price?.toLocaleString() || 'N/A'}</div>
                  <div>Acres: ${property.acres?.toLocaleString() || 'N/A'}</div>
                  <div>City: ${property.city || 'N/A'}</div>
                </div>
              `
            });
            infoWindow.open(map, marker);
          });
        }
      });

      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach(marker => bounds.extend(marker.getPosition() as google.maps.LatLng));
      map.fitBounds(bounds);

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

  useEffect(() => {
    // Filter properties based on search term
    if (searchTerm) {
      setFilteredProperties(properties.filter(property =>
        property.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.broker?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.id?.toString().includes(searchTerm)
      ));
    } else {
      setFilteredProperties(properties);
    }
  }, [searchTerm, properties]);

  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `$${price.toLocaleString()}`;
  };

  const formatAcres = (acres: number | null) => {
    if (acres === null) return 'N/A';
    return `${acres.toLocaleString()} acres`;
  };

  const handlePropertyClick = (property: Demo) => {
    if (googleMapRef.current && property.latitude && property.longitude) {
      googleMapRef.current.setCenter({ lat: property.latitude, lng: property.longitude });
      googleMapRef.current.setZoom(16);

      // For mobile, close the sidebar when a property is selected
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    }
  };

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg border border-red-200">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center mb-2 md:mb-0">
            <h1 className="text-2xl font-bold text-white">Property Explorer</h1>
            <span className="ml-3 bg-white bg-opacity-20 text-black px-2 py-1 rounded-full text-sm">
              {properties.length} listings
            </span>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden bg-white bg-opacity-20 text-white p-2 rounded-md mr-2"
            >
              {isSidebarOpen ? 'Hide List' : 'Show List'}
            </button>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by city, broker, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 p-2 pl-8 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 text-black placeholder:text-gray-500"
              />
              <svg
                className="absolute left-2 top-2.5 h-4 w-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-grow flex relative overflow-hidden">
        {/* Map */}
        <div className="relative flex-grow">
          {isLoading || !isGoogleLoaded ? (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="animate-spin h-12 w-12 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
              <p className="ml-4 text-lg text-gray-700">
                {isLoading ? 'Loading property data...' : 'Loading Google Maps...'}
              </p>
            </div>
          ) : (
            <div ref={mapRef} className="w-full h-full"></div>
          )}

          {hoveredProperty && tooltipPosition && (
            <div
              ref={tooltipRef}
              className="fixed z-10 bg-white shadow-lg rounded-md p-3 w-64 pointer-events-none border-l-4 border-indigo-500"
              style={{
                left: `${tooltipPosition.x + 10}px`,
                top: `${tooltipPosition.y + 10}px`,
              }}
            >
              <div className="font-bold text-indigo-700">Property #{hoveredProperty.id}</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-gray-600">
                <div className="text-gray-600">Broker:</div>
                <div className="font-medium">{hoveredProperty.broker || 'N/A'}</div>

                <div className="text-gray-600">Price:</div>
                <div className="font-medium">{formatPrice(hoveredProperty.price)}</div>

                <div className="text-gray-600">Size:</div>
                <div className="font-medium">{formatAcres(hoveredProperty.acres)}</div>

                <div className="text-gray-600">City:</div>
                <div className="font-medium">{hoveredProperty.city || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Property List Sidebar - Responsive */}
        <div
          className={`
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} 
            transition-transform duration-300 ease-in-out
            fixed md:static right-0 top-16 md:top-0 h-[calc(100vh-64px)] md:h-auto
            w-full sm:w-80 md:w-72 lg:w-80 bg-white shadow-lg z-10 md:z-0
            overflow-y-auto
          `}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Property List</h2>
              <button
                title='Close sidebar'
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {filteredProperties.length > 0 ? (
                filteredProperties.map(property => (
                  <div
                    key={property.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 cursor-pointer border border-gray-200 transition-colors duration-200 transform hover:scale-[1.01]"
                    onClick={() => handlePropertyClick(property)}
                  >
                    <div className="font-medium text-indigo-700">Property #{property.id}</div>
                    <div className="text-sm text-gray-700 mt-1">
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500">Broker:</span>
                        <span className="col-span-2">{property.broker || 'N/A'}</span>

                        <span className="text-gray-500">Price:</span>
                        <span className="col-span-2 font-medium">{formatPrice(property.price)}</span>

                        <span className="text-gray-500">Size:</span>
                        <span className="col-span-2">{formatAcres(property.acres)}</span>

                        <span className="text-gray-500">City:</span>
                        <span className="col-span-2">{property.city || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No properties match your search criteria
                </div>
              )}

              {filteredProperties.length > 0 && filteredProperties.length < properties.length && (
                <div className="text-center text-sm text-gray-500 pt-2">
                  Showing {filteredProperties.length} of {properties.length} properties
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Toggle Button for Map/List View (fixed at bottom) */}
      <div className="md:hidden fixed bottom-4 right-4 z-20">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-indigo-600 text-white p-3 rounded-full shadow-lg flex items-center justify-center"
        >
          {isSidebarOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default PropertyMapPage;