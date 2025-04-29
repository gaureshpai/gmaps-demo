'use client';
import { createData } from '@/backend/db';
import React, { useState, useEffect, useRef, use } from 'react';
interface LocationSelectorProps {
  nextStep: () => void;
  prevStep: () => void;
}

interface LocationData {
  address: string;
  placeId: string;
  lat: number;
  lng: number;
  state?: string;
  city?: string;
  street?: string;
}

// Define delivery cities
const DELIVERY_CITIES = ['Mangaluru', 'bangalore', 'mumbai'];

const LocationSelector: React.FC<LocationSelectorProps> = ({nextStep , prevStep }) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [name,setName] = useState<string>('');
  const [price,setPrice] = useState<string>('');
  const [disabled,setDisabled] = useState<boolean>(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [acres, setAcres] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  // Add state variables to display coordinates
  const [displayCoordinates, setDisplayCoordinates] = useState<{lat: number; lng: number} | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

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

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (!isGoogleLoaded || !mapRef.current) return;

    try {
      const defaultLocation = { lat: 28.6139, lng: 77.2090 };
      const initialLocation = currentLocation || defaultLocation;

      const mapOptions: google.maps.MapOptions = {
        center: initialLocation,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);
      googleMapRef.current = map;

      const marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });
      markerRef.current = marker;

      const geocoder = new google.maps.Geocoder();
      geocoderRef.current = geocoder;

      // Update coordinates immediately on initialization
      setDisplayCoordinates({lat: initialLocation.lat, lng: initialLocation.lng});

      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (position) {
          // Update displayed coordinates when marker is dragged
          setDisplayCoordinates({lat: position.lat(), lng: position.lng()});
          updateLocationFromLatLng(position.lat(), position.lng());
        }
      });

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          marker.setPosition(e.latLng);
          // Update displayed coordinates when map is clicked
          setDisplayCoordinates({lat: e.latLng.lat(), lng: e.latLng.lng()});
          updateLocationFromLatLng(e.latLng.lat(), e.latLng.lng());
        }
      });

      if (currentLocation) {
        updateLocationFromLatLng(currentLocation.lat, currentLocation.lng);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize Google Maps');
    }
  }, [isGoogleLoaded, currentLocation]);

  // Geocode coordinates to address
  const updateLocationFromLatLng = (lat: number, lng: number) => {
    if (!geocoderRef.current) return;

    // Update displayed coordinates
    setDisplayCoordinates({lat, lng});

    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const addressComponents = results[0].address_components;
        const state = addressComponents.find((component) =>
          component.types.includes('administrative_area_level_1')
        )?.long_name;
        const city = addressComponents.find((component) =>
          component.types.includes('locality')
        )?.long_name;
        const street = addressComponents.find((component) =>
          component.types.includes('route')
        )?.long_name;

        const newLocation: LocationData = {
          address: results[0].formatted_address || 'Selected location',
          placeId: results[0].place_id || '',
          lat,
          lng,
          state,
          city,
          street,
        };

        setSelectedLocation(newLocation);
        setState(state || '');
        setCity(city || '');
        setStreet(street || '');

        // Check delivery availability
      }
    });
  };

  // Update map based on state, city, and street
  const updateMapFromAddress = () => {
    if (!geocoderRef.current) return;

    const address = `${street}, ${city}, ${state}`;
    geocoderRef.current.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        if (googleMapRef.current && markerRef.current) {
          googleMapRef.current.setCenter(location);
          markerRef.current.setPosition(location);
          // Update displayed coordinates
          setDisplayCoordinates({lat: location.lat(), lng: location.lng()});
          updateLocationFromLatLng(location.lat(), location.lng());
        }
      } else {
        setError('Could not find the specified address.');
      }
    });
  };

  // Get user's current location
  const handleCurrentLocation = () => {
    setIsLoading(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setCurrentLocation({ lat, lng });
          // Update displayed coordinates
          setDisplayCoordinates({lat, lng});

          if (googleMapRef.current && markerRef.current) {
            googleMapRef.current.setCenter({ lat, lng });
            markerRef.current.setPosition({ lat, lng });
          }

          updateLocationFromLatLng(lat, lng);
          setIsLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Could not access your location. Please check browser permissions.');
          setIsLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setIsLoading(false);
    }
  };

  // Copy coordinates to clipboard
  const copyCoordinates = () => {
    if (displayCoordinates) {
      const text = `${displayCoordinates.lat}, ${displayCoordinates.lng}`;
      navigator.clipboard.writeText(text)
        .then(() => {
          alert('Coordinates copied to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy coordinates:', err);
        });
    }
  };

  // Confirm location selection
  const confirmLocation = async() => {
    if (selectedLocation) {
        await createData({broker:name,price:parseFloat(price),acres:parseFloat(acres),latitude:displayCoordinates?.lat,longitude:displayCoordinates?.lng,city})
    } else if (!selectedLocation) {
      setError('Please select a delivery location');
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
    <div className="w-full max-w-lg mx-auto text-black bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-300-500 p-2 text-black">
        <h2 className="font-bold">Select delivery location</h2>
      </div>

      {!isGoogleLoaded ? (
        <div className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-red-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p>Loading Google Maps...</p>
        </div>
      ) : (
        <>
        <div className='p-4 py-2 bg-gray-50 border-b border-gray-200 space-y-3'>
            <input type="text" 
                placeholder='Name'
                onChange={(e) => setName(e.target.value)}
                value={name}
                className='w-full p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500'
                />
            <div className='relative'>
            <span className='absolute left-0 pl-2 top-1/2 -translate-y-1/2'>₹</span>
            <input type="number" 
                placeholder='enter the price'
                onChange={(e) => setPrice(e.target.value)}
                value={price}
                className='w-full p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 pl-6'
                />
            
            </div>
        </div>
          {/* Map container */}
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-50 bg-gray-100"
            ></div>

            {/* Current location button */}
            <button
              onClick={handleCurrentLocation}
              disabled={isLoading}
              className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg z-10 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Use current location"
            >
              {isLoading ? (
                <div className="animate-spin h-6 w-6 border-2 border-red-500 rounded-full border-t-transparent"></div>
              ) : (
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {/* Coordinates display */}
          {displayCoordinates && (
            <div className="p-4 py-2 bg-blue-50 border-b border-blue-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-blue-800">Exact Coordinates:</h3>
                  <p className="text-gray-700">
                    Latitude: <span className="font-mono">{displayCoordinates.lat.toFixed(6)}</span>
                  </p>
                  <p className="text-gray-700">
                    Longitude: <span className="font-mono">{displayCoordinates.lng.toFixed(6)}</span>
                  </p>
                </div>
                <button
                  onClick={copyCoordinates}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Address fields */}
          <div className="p-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="space-y-3">
            
              <input
                type="text"
                placeholder="State"
                value={state}
                onChange={(e) => {setState(e.target.value)
                  setDisabled(false)
                }}
                className="w-full p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => {setCity(e.target.value)
                  setDisabled(false)}}
                className="w-full p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input
                type="text"
                placeholder="Street"
                value={street}
                onChange={(e) => {setStreet(e.target.value)
                  setDisabled(false)
                }
                }
                className="w-full p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input type="number" 
                placeholder='enter the acres'
                onChange={(e) => setAcres(e.target.value)}
                value={acres}
                className='w-full p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 '
                />
              
              <button
                onClick={()=>{updateMapFromAddress()
                  setDisabled(true)
                }}
                className={`w-full py-1  text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 ${disabled?'!bg-gray-200':'bg-red-500'}`}
                disabled={disabled}
              >
                Update Location
              </button>
            </div>
          </div>

          {/* Delivery status */}
          

          {/* Selected location & confirmation */}
          <div className="p-4 py-1">
            <div className="mb-3">
              <p className="text-gray-600 mt-1">
                {selectedLocation ? selectedLocation.address : 'No location selected'}
              </p>
            </div>
          <div>
            <button
              onClick={confirmLocation}
              className="w-full py-1 bg-red-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Confirm Location
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LocationSelector;