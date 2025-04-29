"use client"

import { createData } from "@/backend/db"
import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation" // Import router for navigation

interface LocationSelectorProps {
  nextStep: () => void
  prevStep: () => void
}

interface LocationData {
  address: string
  placeId: string
  lat: number
  lng: number
  state?: string
  city?: string
  street?: string
}

// Define delivery cities
const DELIVERY_CITIES = ["Mangaluru", "bangalore", "mumbai"]

const LocationSelector: React.FC<LocationSelectorProps> = ({ nextStep, prevStep }) => {
  const router = useRouter() // Initialize the router for navigation
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null)
  const [name, setName] = useState<string>("")
  const [price, setPrice] = useState<string>("")
  const [disabled, setDisabled] = useState<boolean>(true)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isGoogleLoaded, setIsGoogleLoaded] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<string>("")
  const [city, setCity] = useState<string>("")
  const [acres, setAcres] = useState<string>("")
  const [street, setStreet] = useState<string>("")
  // Add state variables to display coordinates
  const [displayCoordinates, setDisplayCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  const mapRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  // Load Google Maps script with API key
  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps API key is required")
      return
    }

    if (typeof window.google !== "undefined" && typeof window.google.maps !== "undefined") {
      setIsGoogleLoaded(true)
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.id = "google-maps-script"

    script.onload = () => {
      setIsGoogleLoaded(true)
    }

    script.onerror = () => {
      setError("Failed to load Google Maps. Please check your API key.")
    }

    document.head.appendChild(script)

    return () => {
      const loadedScript = document.getElementById("google-maps-script")
      if (loadedScript) {
        document.head.removeChild(loadedScript)
      }
    }
  }, [apiKey])

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (!isGoogleLoaded || !mapRef.current) return

    try {
      const defaultLocation = { lat: 28.6139, lng: 77.209 }
      const initialLocation = currentLocation || defaultLocation

      const mapOptions: google.maps.MapOptions = {
        center: initialLocation,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      }

      const map = new google.maps.Map(mapRef.current, mapOptions)
      googleMapRef.current = map

      const marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
      })
      markerRef.current = marker

      const geocoder = new google.maps.Geocoder()
      geocoderRef.current = geocoder

      // Update coordinates immediately on initialization
      setDisplayCoordinates({ lat: initialLocation.lat, lng: initialLocation.lng })

      marker.addListener("dragend", () => {
        const position = marker.getPosition()
        if (position) {
          // Update displayed coordinates when marker is dragged
          setDisplayCoordinates({ lat: position.lat(), lng: position.lng() })
          updateLocationFromLatLng(position.lat(), position.lng())
        }
      })

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          marker.setPosition(e.latLng)
          // Update displayed coordinates when map is clicked
          setDisplayCoordinates({ lat: e.latLng.lat(), lng: e.latLng.lng() })
          updateLocationFromLatLng(e.latLng.lat(), e.latLng.lng())
        }
      })

      if (currentLocation) {
        updateLocationFromLatLng(currentLocation.lat, currentLocation.lng)
      }
    } catch (err) {
      console.error("Error initializing map:", err)
      setError("Failed to initialize Google Maps")
    }
  }, [isGoogleLoaded, currentLocation])

  // Geocode coordinates to address
  const updateLocationFromLatLng = (lat: number, lng: number) => {
    if (!geocoderRef.current) return

    // Update displayed coordinates
    setDisplayCoordinates({ lat, lng })

    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const addressComponents = results[0].address_components
        const state = addressComponents.find((component) =>
          component.types.includes("administrative_area_level_1"),
        )?.long_name
        const city = addressComponents.find((component) => component.types.includes("locality"))?.long_name
        const street = addressComponents.find((component) => component.types.includes("route"))?.long_name

        const newLocation: LocationData = {
          address: results[0].formatted_address || "Selected location",
          placeId: results[0].place_id || "",
          lat,
          lng,
          state,
          city,
          street,
        }

        setSelectedLocation(newLocation)
        setState(state || "")
        setCity(city || "")
        setStreet(street || "")
      }
    })
  }

  // Update map based on state, city, and street
  const updateMapFromAddress = () => {
    if (!geocoderRef.current) return

    const address = `${street}, ${city}, ${state}`
    geocoderRef.current.geocode({ address }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location
        if (googleMapRef.current && markerRef.current) {
          googleMapRef.current.setCenter(location)
          markerRef.current.setPosition(location)
          // Update displayed coordinates
          setDisplayCoordinates({ lat: location.lat(), lng: location.lng() })
          updateLocationFromLatLng(location.lat(), location.lng())
        }
      } else {
        setError("Could not find the specified address.")
      }
    })
  }

  // Get user's current location
  const handleCurrentLocation = () => {
    setIsLoading(true)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          setCurrentLocation({ lat, lng })
          // Update displayed coordinates
          setDisplayCoordinates({ lat, lng })

          if (googleMapRef.current && markerRef.current) {
            googleMapRef.current.setCenter({ lat, lng })
            markerRef.current.setPosition({ lat, lng })
          }

          updateLocationFromLatLng(lat, lng)
          setIsLoading(false)
        },
        (error) => {
          console.error("Error getting location:", error)
          setError("Could not access your location. Please check browser permissions.")
          setIsLoading(false)
        },
      )
    } else {
      setError("Geolocation is not supported by this browser.")
      setIsLoading(false)
    }
  }

  // Copy coordinates to clipboard
  const copyCoordinates = () => {
    if (displayCoordinates) {
      const text = `${displayCoordinates.lat}, ${displayCoordinates.lng}`
      navigator.clipboard
        .writeText(text)
        .then(() => {
          alert("Coordinates copied to clipboard!")
        })
        .catch((err) => {
          console.error("Failed to copy coordinates:", err)
        })
    }
  }

  // Confirm location selection
  const confirmLocation = async () => {
    if (selectedLocation && displayCoordinates) {
      try {
        await createData({
          broker: name,
          price: Number.parseFloat(price),
          acres: Number.parseFloat(acres),
          latitude: displayCoordinates?.lat,
          longitude: displayCoordinates?.lng,
          city,
        })
        // Call the nextStep function first (if needed for any UI flow)
        nextStep()
        // Then navigate to the /show route
        router.push('/show')
      } catch (err) {
        console.error("Error saving location data:", err)
        setError("Failed to save location data. Please try again.")
      }
    } else if (!selectedLocation) {
      setError("Please select a delivery location")
    }
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
        <div className="p-6 text-red-500 bg-white rounded-xl border border-red-200 shadow-lg max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-bold text-red-700">Error</h2>
          </div>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 w-full py-2 cursor-pointer bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100">
      {!isGoogleLoaded ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div className="animate-spin h-12 w-12 border-4 border-red-500 rounded-full border-t-transparent mb-6"></div>
          <p className="text-xl text-gray-700 font-medium">Loading Google Maps...</p>
          <p className="text-gray-500 mt-2">Please wait while we set up the map</p>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 shadow-sm py-4 px-6">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Location Selector</h1>
                <p className="text-gray-600">Select a location for your property</p>
              </div>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Map section - Left side on desktop, top on mobile */}
            <div className="w-full md:w-3/5 h-1/2 md:h-full relative">
              <div ref={mapRef} className="w-full h-full"></div>

              {/* Current location button */}
              <button
                onClick={handleCurrentLocation}
                disabled={isLoading}
                className="absolute bottom-6 cursor-pointer right-6 bg-white p-3 rounded-full shadow-lg z-10 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                aria-label="Use current location"
              >
                {isLoading ? (
                  <div className="animate-spin h-6 w-6 border-2 border-red-500 rounded-full border-t-transparent"></div>
                ) : (
                  <svg
                    className="w-6 h-6 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>

              {/* Coordinates display - Floating card on the map */}
              {displayCoordinates && (
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-800">Coordinates</h3>
                    <button
                      title="Copy coordinates"
                      onClick={copyCoordinates}
                      className="p-1.5 bg-blue-500 cursor-pointer text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700">
                      Lat: <span className="font-mono text-blue-700">{displayCoordinates.lat.toFixed(6)}</span>
                    </p>
                    <p className="text-gray-700">
                      Lng: <span className="font-mono text-blue-700">{displayCoordinates.lng.toFixed(6)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Form section - Right side on desktop, bottom on mobile */}
            <div className="w-full md:w-2/5 h-1/2 md:h-full bg-white border-t md:border-t-0 md:border-l border-gray-200 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Property Details Section */}
                <section>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    Property Details
                  </h2>
                  <div className="space-y-4">
                    <div className="group">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Broker Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        placeholder="Enter broker name"
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                        className="w-full p-3 placeholder:text-black/50 text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                    </div>

                    <div className="group">
                      <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                        Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-0 pl-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          id="price"
                          type="number"
                          placeholder="Enter property price"
                          onChange={(e) => setPrice(e.target.value)}
                          value={price}
                          className="w-full p-3 placeholder:text-black/50 text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all pl-8"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label htmlFor="acres" className="block text-sm font-medium text-gray-700 mb-1">
                        Property Size (Acres)
                      </label>
                      <input
                        id="acres"
                        type="number"
                        placeholder="Enter property size in acres"
                        onChange={(e) => setAcres(e.target.value)}
                        value={acres}
                        className="w-full p-3 placeholder:text-black/50 text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                    </div>
                  </div>
                </section>

                {/* Address Details Section */}
                <section>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Address Details
                  </h2>
                  <div className="space-y-4">
                    <div className="group">
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        id="state"
                        type="text"
                        placeholder="Enter state"
                        value={state}
                        onChange={(e) => {
                          setState(e.target.value)
                          setDisabled(false)
                        }}
                        className="w-full placeholder:text-black/50 text-black p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                    </div>

                    <div className="group">
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        id="city"
                        type="text"
                        placeholder="Enter city"
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value)
                          setDisabled(false)
                        }}
                        className="w-full placeholder:text-black/50 text-black p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                    </div>

                    <div className="group">
                      <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                        Street
                      </label>
                      <input
                        id="street"
                        type="text"
                        placeholder="Enter street"
                        value={street}
                        onChange={(e) => {
                          setStreet(e.target.value)
                          setDisabled(false)
                        }}
                        className="w-full placeholder:text-black/50 text-black p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                    </div>

                    <button
                      onClick={() => {
                        updateMapFromAddress()
                        setDisabled(true)
                      }}
                      className={`w-full py-3 px-4 rounded-lg font-medium cursor-pointer transition-all ${disabled
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg"
                        }`}
                      disabled={disabled}
                    >
                      Update Map Location
                    </button>
                  </div>
                </section>

                {/* Selected Location Section */}
                <section>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Selected Location
                  </h2>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                    {selectedLocation ? (
                      <p className="text-gray-700">{selectedLocation.address}</p>
                    ) : (
                      <p className="text-gray-500 italic">No location selected yet. Click on the map to select.</p>
                    )}
                  </div>

                  <button
                    onClick={confirmLocation}
                    className="w-full py-3 px-4 bg-red-500 cursor-pointer text-white rounded-lg font-medium hover:bg-red-600 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Confirm Location
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationSelector