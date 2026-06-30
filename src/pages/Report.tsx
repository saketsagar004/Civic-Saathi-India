import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Camera, MapPin, Upload, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { checkDuplicateIssue } from '../utils/geo';

export default function Report() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const MAPS_API_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    '';

  // Get user location automatically when component mounts
  useEffect(() => {
    handleGetLocation();
  }, []);

  const handleGetLocation = () => {
    setGettingLocation(true);
    setLocationError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setGettingLocation(false);
        },
        (error) => {
          console.warn("Error getting location:", error.message);
          setGettingLocation(false);
          setLocationError("Could not detect GPS location. Please enter your address below.");
        }
      );
    } else {
      setGettingLocation(false);
      setLocationError("Geolocation is not supported by your browser.");
    }
  };

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setLocationError(null);
    
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_API_KEY}`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        setLocation({ lat, lng });
        setAddress(""); // Clear address after success
      } else {
        setLocationError("Could not find coordinates for that address.");
      }
    } catch (err) {
      console.error(err);
      setLocationError("Failed to lookup address.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
    
    // Reset states
    setAnalysisResult(null);
    setDuplicateWarning(null);
    setError(null);
  };

  useEffect(() => {
    async function checkDup() {
      if (location && analysisResult && analysisResult.category) {
        const dup = await checkDuplicateIssue(analysisResult.category, location.lat, location.lng);
        setDuplicateWarning(dup);
      }
    }
    checkDup();
  }, [location, analysisResult]);

  const handleAnalyze = async () => {
    if (!previewUrl) return;
    
    setAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: previewUrl }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }
      
      const data = await response.json();
      setAnalysisResult(data);
    } catch (err: any) {
      console.error(err);
      setError('AI Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchDepartmentInfo = async (loc: { lat: number; lng: number }, category: string) => {
    try {
      // 1. Reverse Geocoding
      const geoResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&key=${MAPS_API_KEY}`);
      const geoData = await geoResponse.json();
      
      let fullAddress = "Unknown Location";
      let city = "", district = "", state = "";

      if (geoData.results && geoData.results.length > 0) {
        fullAddress = geoData.results[0].formatted_address;
        const components = geoData.results[0].address_components;
        components.forEach((component: any) => {
          if (component.types.includes("locality")) city = component.long_name;
          if (component.types.includes("administrative_area_level_2")) district = component.long_name;
          if (component.types.includes("administrative_area_level_1")) state = component.long_name;
        });
      }

      // 2. Detect Department via Gemini
      const addressDetails = `${fullAddress}, ${city}, ${district}, ${state}`;
      const depResponse = await fetch('/api/detect-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressDetails, category }),
      });

      if (!depResponse.ok) throw new Error('Failed to detect department');
      
      const depData = await depResponse.json();
      
      return {
        address: fullAddress,
        city,
        district,
        state,
        departmentInfo: depData
      };
    } catch (err) {
      console.error("Department detection failed", err);
      return null;
    }
  };

  const handleSubmit = async (ignoreDuplicate = false) => {
    if (!user || !file || !analysisResult || !location) {
      setError('Missing required information to submit report.');
      return;
    }

    if (duplicateWarning && !ignoreDuplicate) {
      // User must acknowledge duplicate
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Fetch dynamic department info
      const extendedInfo = await fetchDepartmentInfo(location, analysisResult.category);

      // Find matching officer
      let assignedOfficerUid = "";
      let assignedOfficerName = "";
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'officer'), where('department', '==', analysisResult.department));
        const qs = await getDocs(q);
        if (!qs.empty) {
          const officerDoc = qs.docs[0].data();
          assignedOfficerUid = officerDoc.uid;
          assignedOfficerName = officerDoc.displayName || officerDoc.email;
        }
      } catch (err) {
        console.error("Error finding officer:", err);
      }

      // 1. Upload image to Firebase Storage
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${user.uid}.${fileExt}`;
      const storageRef = ref(storage, `reports/${fileName}`);
      
      const snapshot = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 2. Save report to Firestore
      const reportsRef = collection(db, 'reports');
      await addDoc(reportsRef, {
        userId: user.uid,
        imageUrl: downloadURL,
        category: analysisResult.category,
        severity: analysisResult.severity,
        description: analysisResult.description,
        department: analysisResult.department, // the broad one
        assignedOfficerUid,
        assignedOfficerName,
        location: location,
        address: extendedInfo?.address || "",
        city: extendedInfo?.city || "",
        district: extendedInfo?.district || "",
        state: extendedInfo?.state || "",
        departmentInfo: extendedInfo?.departmentInfo || null,
        timestamp: Date.now(),
        status: "Reported",
        upvoteCount: 0,
        upvotedBy: []
      });

      // 3. Navigate to Map focused on new report
      navigate('/map', { state: { center: location, zoom: 14 } });
      
    } catch (err: any) {
      console.error(err);
      setError('Failed to submit report. ' + err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-6 tracking-tight">Report a Civic Issue</h1>
        
        {/* Step 1: Upload Photo */}
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
              1. Upload Photo of the Issue
            </label>
            {!previewUrl ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="space-y-1 text-center">
                  <Camera className="mx-auto h-12 w-12 text-slate-300" />
                  <div className="flex text-sm text-slate-600 justify-center">
                    <span className="relative rounded-md font-bold text-blue-600 hover:text-blue-500">
                      Upload a file
                    </span>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={previewUrl} alt="Preview" className="w-full h-64 object-cover" />
                <button 
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setAnalysisResult(null);
                  }}
                  className="absolute top-2 right-2 bg-slate-900/60 text-white p-1.5 rounded-full hover:bg-slate-900/80 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          {/* Step 2: Location */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
              2. Location
            </label>
            <div className="flex flex-col space-y-3 p-3 border border-slate-200 rounded-xl bg-slate-50">
              <div className="flex items-center">
                <MapPin className="w-5 h-5 text-slate-400 mr-3" />
                <div className="flex-1">
                  {gettingLocation ? (
                    <p className="text-xs text-slate-600 font-medium flex items-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Getting location...
                    </p>
                  ) : location ? (
                    <p className="text-xs text-slate-800 font-bold tracking-tight">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">Auto-detecting GPS...</p>
                  )}
                </div>
                {!location && !gettingLocation && (
                  <button 
                    onClick={handleGetLocation}
                    className="text-xs text-blue-600 hover:text-blue-700 font-bold px-2 py-1 bg-blue-50 rounded-md"
                  >
                    Retry GPS
                  </button>
                )}
              </div>

              {(!location || locationError) && (
                <div className="pt-2 border-t border-slate-200">
                  {locationError && (
                    <p className="text-xs text-red-600 font-bold mb-2">{locationError}</p>
                  )}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Enter address manually (e.g. 123 Main St, City)"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleGeocode}
                      disabled={geocoding || !address.trim()}
                      className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {geocoding ? 'Finding...' : 'Find Address'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-xs font-medium text-red-800">{error}</p>
            </div>
          )}

          {/* Step 3: Analyze Button */}
          {previewUrl && !analysisResult && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-lg shadow-blue-200 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing image with AI...
                </>
              ) : (
                <>
                  Analyze Issue
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          )}

          {/* Step 4: AI Analysis Results & Submission */}
          {analysisResult && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-800 p-4 relative">
                 <div className="absolute top-3 right-4">
                  <span className="bg-blue-600/30 backdrop-blur-md border border-blue-400 text-blue-100 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                    Verified by Gemini
                  </span>
                 </div>
                 <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">AI Analysis Result</p>
                 <h4 className="text-lg font-bold text-white">{analysisResult.category} • Severity {analysisResult.severity}</h4>
              </div>
              
              <div className="p-5 bg-white">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Assigned Department</p>
                    <p className="text-sm font-semibold text-slate-800">{analysisResult.department}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Coordinates</p>
                    <p className="text-sm font-semibold text-slate-800 tracking-tight">
                      {location?.lat.toFixed(4)}, {location?.lng.toFixed(4)}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  "{analysisResult.description}"
                </p>

                {/* Duplicate Warning */}
                {duplicateWarning && (
                  <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-xl flex items-start gap-3">
                    <div className="p-1 bg-amber-200 rounded-full flex-shrink-0 mt-1">
                      <AlertTriangle className="w-4 h-4 text-amber-800" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-800 mb-1">
                        Similar issue already reported nearby
                      </p>
                      <button 
                        onClick={() => navigate(`/issue/${duplicateWarning.id}`)}
                        className="text-xs font-bold text-amber-900 hover:text-amber-700 underline"
                      >
                        View existing report
                      </button>
                    </div>
                  </div>
                )}

                {/* Final Submit Button */}
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting || !location}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-lg shadow-blue-200 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Submitting Report...
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
