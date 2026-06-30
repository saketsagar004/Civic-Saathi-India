import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { CivicIssueReport, UserProfile } from '../types';
import { MapPin, Clock, Building, ArrowLeft, ThumbsUp, AlertTriangle, CheckCircle, ShieldCheck, Camera, Loader2, Star, Mail, Phone, Globe, Wrench, XCircle } from 'lucide-react';

export default function IssueDetail() {
  const { id } = useParams();
  const { user, profile, activeRole, demoRole, demoDepartment } = useAuth();
  const [report, setReport] = useState<CivicIssueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Worker Assignment (Officer)
  const [departmentWorkers, setDepartmentWorkers] = useState<UserProfile[]>([]);
  const [selectedWorkerUid, setSelectedWorkerUid] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // Resolution Photo (Worker)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Feedback State
  const [stars, setStars] = useState<number>(0);
  const [hoverStar, setHoverStar] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    async function fetchReport() {
      if (!id) return;
      try {
        const docRef = doc(db, 'reports', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const reportData = { id: docSnap.id, ...docSnap.data() } as CivicIssueReport;
          setReport(reportData);
          if (activeRole === 'officer' || activeRole === 'super_admin') {
            setSelectedDepartment(demoDepartment || reportData.department || "");
          }
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id, activeRole, demoRole, demoDepartment]);

  useEffect(() => {
    async function fetchWorkers() {
      if (!selectedDepartment || (activeRole !== 'officer' && activeRole !== 'super_admin')) return;
      try {
        const workQ = query(
          collection(db, 'users'), 
          where('role', '==', 'worker'),
          where('department', '==', selectedDepartment)
        );
        const workSnap = await getDocs(workQ);
        const fetchedWorkers: UserProfile[] = [];
        workSnap.forEach(d => fetchedWorkers.push(d.data() as UserProfile));
        setDepartmentWorkers(fetchedWorkers);
        if (!fetchedWorkers.find(w => w.uid === selectedWorkerUid)) {
          setSelectedWorkerUid(""); // Reset if not in new department
        }
      } catch (error) {
        console.error("Error fetching workers:", error);
      }
    }
    fetchWorkers();
  }, [selectedDepartment, activeRole]);

  const addNotification = async (uid: string, title: string, message: string, type: string) => {
    if (!id) return;
    await addDoc(collection(db, 'notifications'), {
      uid, title, message, issueId: id, timestamp: Date.now(), read: false, type
    });
  };

  const handleUpvote = async () => {
    if (!user || !report || !id || actionLoading) return;
    setActionLoading(true);
    try {
      const docRef = doc(db, 'reports', id);
      const hasUpvoted = report.upvotedBy?.includes(user.uid);
      
      if (hasUpvoted) {
        await updateDoc(docRef, {
          upvotedBy: arrayRemove(user.uid),
          upvoteCount: Math.max(0, report.upvoteCount - 1)
        });
        setReport({
          ...report,
          upvotedBy: report.upvotedBy.filter(uid => uid !== user.uid),
          upvoteCount: Math.max(0, report.upvoteCount - 1)
        });
      } else {
        const newUpvoteCount = report.upvoteCount + 1;
        let newStatus = report.status;
        let updates: any = {
          upvotedBy: arrayUnion(user.uid),
          upvoteCount: newUpvoteCount,
        };

        if (report.status === "Reported" && newUpvoteCount >= 3) {
          newStatus = "Verified";
          updates.status = "Verified";
          updates.verifiedAt = Date.now();
          await addNotification(report.userId, "✅ Issue Verified", `Your reported issue has been officially verified by community.`, 'verified');
        }
        
        await updateDoc(docRef, updates);
        setReport({
          ...report,
          ...updates,
          upvotedBy: [...(report.upvotedBy || []), user.uid],
        });
      }
    } catch (error) {
      console.error("Error toggling upvote:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignWorker = async () => {
    if (!user || !report || !id || !selectedWorkerUid || actionLoading) return;
    setActionLoading(true);
    try {
      const selectedWorker = departmentWorkers.find(w => w.uid === selectedWorkerUid);
      if (!selectedWorker) throw new Error("Worker not found");

      const updates = {
        status: "Assigned" as const,
        department: selectedDepartment,
        assignedOfficerUid: profile?.uid || user.uid,
        assignedOfficerName: profile?.displayName || user.displayName || user.email,
        assignedWorkerUid: selectedWorker.uid,
        assignedWorkerName: selectedWorker.displayName || selectedWorker.email,
        assignedAt: Date.now()
      };

      await updateDoc(doc(db, 'reports', id), updates);
      
      await addNotification(report.userId, "Issue Assigned", `Your reported issue has been assigned to a worker by an Officer.`, 'new_assignment');
      await addNotification(selectedWorker.uid, "New Assignment", `Issue #${id.slice(-6).toUpperCase()} (${report.category} at ${report.address || 'Unknown'}) has been assigned to you by Officer ${updates.assignedOfficerName}`, 'new_assignment');

      setReport({ ...report, ...updates });
    } catch (error) {
      console.error("Error assigning worker:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWorkerAccept = async () => {
    if (!user || !report || !id || actionLoading) return;
    setActionLoading(true);
    try {
      const updates = {
        status: "In Progress" as const,
        inProgressAt: Date.now()
      };
      await updateDoc(doc(db, 'reports', id), updates);
      
      await addNotification(report.userId, "Work Started", `A worker has started working on your issue at ${report.address || 'the location'}.`, 'work_started');
      if (report.assignedOfficerUid) {
        await addNotification(report.assignedOfficerUid, "Work Started", `Worker ${report.assignedWorkerName} started work on Issue #${id.slice(-6).toUpperCase()}.`, 'work_started');
      }

      setReport({ ...report, ...updates });
    } catch (error) {
      console.error("Error accepting work:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access denied or blocked.", err);
      alert("Camera access denied. Please enable camera permissions in your browser settings and try again. If you are in a preview environment, try using the fallback upload option.");
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setResolutionPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setResolutionPreview(dataUrl);
        stopCamera();
      }
    }
  };

  const submitResolutionProof = async () => {
    if (!user || !report || !id || !resolutionPreview || actionLoading) return;
    setActionLoading(true);
    
    try {
      // 1. Get current GPS to verify within 100m
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
      const toRad = (val: number) => val * Math.PI / 180;
      const R = 6371e3; // metres
      const φ1 = toRad(report.location.lat);
      const φ2 = toRad(pos.coords.latitude);
      const Δφ = toRad(pos.coords.latitude - report.location.lat);
      const Δλ = toRad(pos.coords.longitude - report.location.lng);

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      const isAdmin = user?.email === 'saketsagar004@gmail.com';

      if (distance > 100 && !isAdmin) {
        alert("You must be physically at the issue location (within 100m) to submit proof");
        setActionLoading(false);
        return;
      }

      // 2. Ask Gemini to verify
      const response = await fetch('/api/verify-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: resolutionPreview }),
      });
      
      const verdict = await response.json();
      
      if (verdict.isAIGenerated) {
        alert("Resolution photo rejected: Appears to be AI-generated. Please take a real photo at the location.");
        setActionLoading(false);
        return;
      }
      
      if (!verdict.isResolved) {
        alert(`Resolution photo rejected: ${verdict.reason}`);
        setActionLoading(false);
        return;
      }

      // 3. Upload File from base64
      const res = await fetch(resolutionPreview);
      const blob = await res.blob();
      const fileName = `${Date.now()}_res_${user.uid}.jpg`;
      const storageRef = ref(storage, `resolutions/${fileName}`);
      
      const snapshot = await uploadBytesResumable(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 4. Update Document
      const updates = {
        status: "Pending Verification" as const,
        resolutionImageUrl: downloadURL,
        resolutionVerdict: verdict,
        pendingVerificationAt: Date.now()
      };
      await updateDoc(doc(db, 'reports', id), updates);

      await addNotification(report.userId, "📸 Resolution Submitted", `Resolution proof submitted for your issue. Officer is reviewing.`, 'resolution_submitted');
      if (report.assignedOfficerUid) {
        await addNotification(report.assignedOfficerUid, "📸 Resolution Proof Ready", `Worker ${report.assignedWorkerName} has submitted resolution proof for Issue #${id.slice(-6).toUpperCase()}. Please review.`, 'resolution_submitted');
      }

      setReport({ ...report, ...updates });
      setResolutionPreview(null);
    } catch (err: any) {
      console.error(err);
      alert("Error submitting resolution proof. Check your GPS permissions.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOfficerApproveResolution = async () => {
    if (!user || !report || !id || actionLoading) return;
    setActionLoading(true);
    try {
      const updates = {
        status: "Resolved" as const,
        resolvedAt: Date.now()
      };
      await updateDoc(doc(db, 'reports', id), updates);
      
      await addNotification(report.userId, "🎉 Issue Resolved!", `Your issue has been resolved! Please confirm and share feedback.`, 'resolved');
      if (report.assignedWorkerUid) {
        await addNotification(report.assignedWorkerUid, "✅ Work Confirmed", `Officer ${profile?.displayName || 'Admin'} has confirmed your resolution of Issue #${id.slice(-6).toUpperCase()}`, 'work_confirmed');
      }

      setReport({ ...report, ...updates });
    } catch (error) {
      console.error("Error approving resolution:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOfficerRejectResolution = async () => {
    if (!user || !report || !id || actionLoading) return;
    
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejecting.");
      return;
    }

    setActionLoading(true);
    try {
      const updates = {
        status: "In Progress" as const,
        resolutionImageUrl: "", // clear it
        resolutionVerdict: null, // clear it
        rejectReason: rejectReason.trim()
      };
      await updateDoc(doc(db, 'reports', id), updates);
      
      if (report.assignedWorkerUid) {
        await addNotification(report.assignedWorkerUid, "Photo Rejected", `Your resolution photo for Issue #${id.slice(-6).toUpperCase()} was rejected: ${rejectReason.trim()}. Please resubmit.`, 'photo_rejected');
      }

      setReport({ ...report, status: "In Progress", resolutionImageUrl: undefined, resolutionVerdict: undefined });
    } catch (error) {
      console.error("Error rejecting resolution:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOfficerCloseIssue = async () => {
    if (!user || !report || !id || actionLoading) return;
    setActionLoading(true);
    try {
      const updates = {
        status: "Closed" as const,
        closedAt: Date.now()
      };
      await updateDoc(doc(db, 'reports', id), updates);
      
      await addNotification(report.userId, "✅ Issue Closed", `Issue #${id.slice(-6).toUpperCase()} has been successfully closed. Thank you for reporting!`, 'closed');

      setReport({ ...report, ...updates });
    } catch (error) {
      console.error("Error closing report:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!user || !report || !id || actionLoading) return;
    setActionLoading(true);
    try {
      const feedback = {
        stars,
        comment: feedbackText,
        suggestion: suggestionText,
        timestamp: Date.now()
      };
      
      await updateDoc(doc(db, 'reports', id), { 
        feedback,
        status: 'Closed'
      });
      
      if (report.assignedOfficerUid) {
        await addNotification(report.assignedOfficerUid, "⭐ Citizen Feedback", `Citizen rated Issue #${id.slice(-6).toUpperCase()} resolution: ${stars}/5 stars`, 'feedback');
      }

      setReport({ ...report, feedback, status: 'Closed' });
      setShowFeedback(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFeedbackSkip = async () => {
    if (!user || !report || !id || actionLoading) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'reports', id), { 
        status: 'Closed'
      });
      setReport({ ...report, status: 'Closed' });
      setShowFeedback(false);
    } catch (error) {
      console.error("Error closing report without feedback:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900">Issue not found</h2>
        <Link to="/map" className="mt-4 text-blue-600 hover:underline font-bold">Return to map</Link>
      </div>
    );
  }

  const hasUpvoted = user ? report.upvotedBy?.includes(user.uid) : false;
  
  const isOfficer = activeRole === 'officer' || activeRole === 'super_admin';
  const isWorker = activeRole === 'worker';
  const isCitizen = activeRole === 'citizen';
  
  // Specific ownership (bypass in demo mode for admin)
  const isOwnerAdmin = user?.email === 'saketsagar004@gmail.com';
  const isReporter = isCitizen && ((user?.uid === report.userId) || isOwnerAdmin);
  const isAssignedWorker = (report.assignedWorkerUid === user?.uid) || (isOwnerAdmin && activeRole === 'worker');

  // Timeline Stepper Logic
  const steps = ["Reported", "Verified", "Assigned", "In Progress", "Pending Verification", "Resolved", "Closed"];
  const currentStepIndex = steps.indexOf(report.status);

  return (
    <div className="w-full pb-12">
      <div className="max-w-[1200px] mx-auto px-6 mb-6 flex justify-between items-center">
        <Link to="/map" className="text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center transition-colors uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Map
        </Link>
      </div>

      {/* TIMELINE STEPPER */}
      <div className="w-full bg-white shadow-sm border-y border-slate-200 p-6 mb-8 overflow-x-auto">
        <div className="max-w-[1200px] mx-auto min-w-[900px]">
          {/* Top horizontal stepper */}
          <div className="flex items-start justify-between relative pt-2 mb-8 mx-auto px-8">
            <div className="absolute top-6 left-12 right-12 h-px bg-slate-200 -z-10"></div>
            {steps.map((step, idx) => {
              const isCompleted = idx < currentStepIndex || report.status === step;
              const isCurrent = report.status === step;
              const isFuture = idx > currentStepIndex;

              let ts = null;
              if (step === "Reported") ts = report.timestamp;
              if (step === "Verified") ts = report.verifiedAt;
              if (step === "Assigned") ts = report.assignedAt;
              if (step === "In Progress") ts = report.inProgressAt;
              if (step === "Pending Verification") ts = report.pendingVerificationAt;
              if (step === "Resolved") ts = report.resolvedAt;
              if (step === "Closed") ts = report.closedAt;

              return (
                <div key={step} className="flex flex-col items-center relative bg-white px-2 w-32">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors ${
                    isCurrent ? 'bg-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.2)] animate-pulse' :
                    isCompleted ? 'bg-green-500 text-white' :
                    'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    {isCompleted && !isCurrent ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div className={`text-[11px] font-bold mt-2 uppercase tracking-[0.5px] text-center leading-tight ${
                    isCurrent ? 'text-blue-600' :
                    isCompleted ? 'text-slate-800' :
                    'text-slate-400'
                  }`}>
                    {isCompleted || isCurrent ? `✅ ${step}` : step}
                  </div>
                  {(isCompleted || isCurrent) && ts && (
                    <div className="text-[12px] text-slate-500 mt-1 whitespace-nowrap">
                      {new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Details Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider text-center w-[60px]">Step</th>
                  <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider w-[180px]">Status</th>
                  <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider w-[200px]">Date &amp; Time</th>
                  <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Technologies Used</th>
                </tr>
              </thead>
              <tbody className="text-[14px]">
                {steps.map((step, idx) => {
                  const isCompleted = idx < currentStepIndex || report.status === step;
                  const isCurrent = report.status === step;
                  
                  let ts = null;
                  if (step === "Reported") ts = report.timestamp;
                  if (step === "Verified") ts = report.verifiedAt;
                  if (step === "Assigned") ts = report.assignedAt;
                  if (step === "In Progress") ts = report.inProgressAt;
                  if (step === "Pending Verification") ts = report.pendingVerificationAt;
                  if (step === "Resolved") ts = report.resolvedAt;
                  if (step === "Closed") ts = report.closedAt;

                  let techTags: string[] = [];
                  if (step === "Reported") techTags = ["Firebase Authentication", "Firebase Storage", "Gemini AI: Duplicate Detection (100m radius)"];
                  if (step === "Verified") techTags = ["Gemini Vision AI: Issue Analysis", "Community Confidence Scoring"];
                  if (step === "Assigned") techTags = ["Gemini AI: Dynamic Department Detection", "Google Maps Geocoding API: Location Detection"];
                  if (step === "In Progress") techTags = ["GPS Verification: 100m Radius Check"];
                  if (step === "Pending Verification") techTags = ["Gemini Vision AI: Resolution Photo Analysis", "Gemini AI: Synthetic Image Detection"];
                  if (step === "Resolved") techTags = ["Gemini AI Verified", "GPS Location Confirmed"];
                  if (step === "Closed") techTags = ["Citizen Feedback System", "Star Rating System"];

                  let borderClass = isCurrent ? "border-l-blue-600" : (isCompleted ? "border-l-green-500" : "border-l-slate-200");
                  let bgClass = isCurrent ? "bg-[#EFF6FF]" : (idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]");

                  return (
                    <tr key={step} className={`border-b border-[#F3F4F6] last:border-b-0 border-l-[3px] ${borderClass} ${bgClass}`}>
                      <td className="py-4 px-4 font-bold text-blue-600 text-center w-[60px]">{idx + 1}</td>
                      <td className="py-4 px-4 w-[180px]">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest ${
                          isCurrent ? 'bg-blue-100 text-blue-700' :
                          isCompleted ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {step}
                        </span>
                      </td>
                      <td className="py-4 px-4 w-[200px] text-[13px] text-slate-700">
                        {ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : <span className="text-slate-400 italic">Pending</span>}
                      </td>
                      <td className="py-4 px-4">
                        <div className={`flex flex-col gap-1 ${isCompleted || isCurrent ? 'text-blue-700 font-medium' : 'text-slate-400'}`}>
                          {techTags.map((tag, i) => (
                            <div key={i} className="flex gap-2">
                              <span>{i + 1}.</span>
                              <span>{tag}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: ISSUE INFO ROW */}
      <div className="w-full max-w-[1200px] mx-auto px-6 mb-4">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
          {/* Col 1 (40% - 5 cols) */}
          <div className="md:col-span-5 relative rounded-lg overflow-hidden bg-slate-100 aspect-video">
            <img src={report.imageUrl} alt="Issue location" className="w-full h-full object-cover" />
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm backdrop-blur-md ${
                report.severity === 'High' ? 'bg-red-500/90 text-white' :
                report.severity === 'Medium' ? 'bg-orange-500/90 text-white' :
                'bg-yellow-400/90 text-yellow-900'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                {report.severity} Severity
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-white/90 text-slate-800 uppercase tracking-widest shadow-sm backdrop-blur-md">
                {report.category}
              </span>
            </div>
          </div>

          {/* Col 2 (35% - 4 cols) */}
          <div className="md:col-span-4 flex flex-col pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">AI Description</h3>
            <p className="text-slate-700 leading-relaxed text-sm flex-grow">{report.description}</p>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={handleUpvote}
                disabled={actionLoading || isReporter}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all w-full justify-center ${
                  hasUpvoted
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700' 
                    : isReporter
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${hasUpvoted ? 'fill-current' : ''}`} />
                {report.upvoteCount} Community Verifications
              </button>
            </div>
          </div>

          {/* Col 3 (25% - 3 cols) */}
          <div className="md:col-span-3 flex flex-col gap-6 pt-2 border-l border-slate-100 pl-6">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Location Details</h3>
              <div className="flex items-start text-slate-700">
                <MapPin className="w-4 h-4 text-blue-600 mr-2 mt-0.5 shrink-0" />
                <div className="text-sm font-medium leading-snug">
                  {report.address || `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`}
                  {(report.city || report.district || report.state) && (
                    <div className="text-xs text-slate-500 font-medium mt-1">
                      {[report.district, report.city, report.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Department Info</h3>
              <div className="flex items-start text-slate-700">
                <Building className="w-4 h-4 text-blue-600 mr-2 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {report.departmentInfo?.departmentName || report.department}
                  </p>
                  {report.departmentInfo?.city && (
                    <p className="text-xs text-slate-500 mt-1">{report.departmentInfo.city}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: OFFICER CONTROLS */}
      {isOfficer && (
        <div className="w-full max-w-[1200px] mx-auto px-6 mb-4">
          <div className="w-full bg-blue-50 rounded-xl border border-blue-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-4">Officer Controls</h3>
            
            {(report.status === 'Reported' || report.status === 'Verified') ? (
              <div className="grid md:grid-cols-2 gap-6 items-end">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-800 uppercase tracking-widest mb-2">Department</label>
                      <select 
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select Department...</option>
                        <option value="Public Works">Public Works</option>
                        <option value="Municipal Corporation">Municipal Corporation</option>
                        <option value="Jal Board">Jal Board</option>
                        <option value="Electricity">Electricity</option>
                        <option value="Law & Enforcement">Law & Enforcement</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-blue-800 uppercase tracking-widest mb-2">Assign Worker</label>
                      <select 
                        value={selectedWorkerUid}
                        onChange={(e) => setSelectedWorkerUid(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select Worker...</option>
                        {departmentWorkers.map(w => (
                          <option key={w.uid} value={w.uid}>{w.displayName || w.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleAssignWorker}
                    disabled={actionLoading || !selectedWorkerUid || !selectedDepartment}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-2" /> Verify & Assign</>}
                  </button>
                </div>
              </div>
            ) : report.status === 'Pending Verification' ? (
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div>
                  <div className="relative rounded-xl overflow-hidden bg-slate-100 aspect-video mb-3">
                    <img src={report.resolutionImageUrl} alt="Resolution" className="w-full h-full object-cover" />
                  </div>
                  {report.resolutionVerdict && (
                    <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> AI Verdict
                        </h3>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md uppercase tracking-widest">
                          Match: {Math.round(report.resolutionVerdict.resolutionConfidence * 100)}%
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{report.resolutionVerdict.reason}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 h-full justify-center">
                  <button
                    onClick={handleOfficerApproveResolution}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center shadow-sm"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-2" /> Confirm Resolved</>}
                  </button>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="Reason for rejection..." 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    />
                    <button
                      onClick={handleOfficerRejectResolution}
                      disabled={actionLoading || !rejectReason.trim()}
                      className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-100 py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-2" /> Reject & Send Back</>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-blue-700 py-2">
                {report.status === 'Resolved' ? 'Awaiting citizen confirmation and feedback to close this issue.' : 'No action required at this stage.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: WORKER CONTROLS */}
      {isAssignedWorker && (
        <div className="w-full max-w-[1200px] mx-auto px-6 mb-4">
          <div className="w-full bg-orange-50 rounded-xl border border-orange-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-4">Worker Controls</h3>
            
            {report.status === 'Assigned' && (
              <button
                onClick={handleWorkerAccept}
                disabled={actionLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wrench className="w-4 h-4 mr-2" /> Accept & Start Work</>}
              </button>
            )}

            {report.status === 'In Progress' && (
              <div className="space-y-4">
                {showCamera ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden bg-black aspect-[3/4] max-w-md mx-auto">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-2 max-w-md mx-auto">
                      <button onClick={capturePhoto} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">Capture</button>
                      <button onClick={stopCamera} className="px-4 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm">Cancel</button>
                    </div>
                  </div>
                ) : resolutionPreview ? (
                  <div className="space-y-3 grid md:grid-cols-2 gap-6 items-center">
                    <img src={resolutionPreview} alt="Preview" className="w-full rounded-xl" />
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={submitResolutionProof}
                        disabled={actionLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-2" /> Verify & Submit Proof</>}
                      </button>
                      <button onClick={() => setResolutionPreview(null)} disabled={actionLoading} className="w-full py-2 text-sm font-bold text-slate-500">Retake Photo</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-[10px] text-yellow-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Photo must be taken live from this app. Gallery uploads are not accepted. You must be within 100m of the issue location.</span>
                    </div>
                    <button
                      onClick={startCamera}
                      disabled={actionLoading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center mb-3"
                    >
                      <Camera className="w-4 h-4 mr-2" /> Submit Resolution Proof
                    </button>
                    <input type="file" id="cameraInput" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                    <button
                      onClick={() => document.getElementById('cameraInput')?.click()}
                      disabled={actionLoading}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
                    >
                      Upload from Gallery (Fallback)
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-2">If camera doesn't open, try uploading a photo instead (camera works fully once app is deployed)</p>
                  </div>
                )}
              </div>
            )}

            {report.status === 'Pending Verification' && (
              <div className="text-center p-4 bg-white/50 rounded-xl border border-orange-200">
                <Clock className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-orange-800">Awaiting Officer Verification</p>
              </div>
            )}
            
            {['Reported', 'Verified', 'Resolved', 'Closed'].includes(report.status) && (
              <div className="text-sm text-orange-700 py-2">
                {report.status === 'Resolved' ? 'Resolution confirmed by officer. Awaiting citizen feedback to close.' : 'No action required at this stage.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: CITIZEN FEEDBACK */}
      {(report.feedback || (isReporter && report.status === 'Resolved')) && (
        <div className="w-full max-w-[1200px] mx-auto px-6 mb-4">
          {report.feedback ? (
             <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-4">Citizen Feedback</h3>
                <div className="flex mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`w-5 h-5 ${star <= report.feedback!.stars ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} />
                  ))}
                </div>
                {report.feedback.comment && report.feedback.comment.trim() !== "" && (
                  <p className="text-slate-700 text-sm mt-3 italic">"{report.feedback.comment}"</p>
                )}
                {report.feedback.suggestion && report.feedback.suggestion.trim() !== "" && (
                  <div className="mt-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Suggestion</h4>
                    <p className="text-slate-700 text-sm mt-1">{report.feedback.suggestion}</p>
                  </div>
                )}
             </div>
          ) : (
            <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              {!showFeedback ? (
                <div className="bg-green-50 rounded-xl border border-green-100 p-6 text-center">
                  <h3 className="text-sm font-bold text-green-800 uppercase tracking-widest mb-2">Issue Resolved!</h3>
                  <p className="text-sm text-green-700 mb-4">The officer has confirmed this issue is resolved. Please provide feedback or close the issue.</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setShowFeedback(true)}
                      className="px-6 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-bold text-sm transition-colors"
                    >
                      Provide Feedback
                    </button>
                    <button
                      onClick={handleFeedbackSkip}
                      disabled={actionLoading}
                      className="px-6 bg-white border border-green-200 text-green-700 hover:bg-green-100 py-2 rounded-xl font-bold text-sm transition-colors"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Skip & Close"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Rate the Resolution</h3>
                  <div className="flex gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setStars(star)}
                        onMouseEnter={() => setHoverStar(star)}
                        onMouseLeave={() => setHoverStar(0)}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star className={`w-8 h-8 ${star <= (hoverStar || stars) ? 'text-yellow-400 fill-current drop-shadow-sm' : 'text-slate-200'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Share your thoughts on how this was handled (optional)..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-3 h-24 resize-none bg-slate-50"
                  ></textarea>
                  <textarea
                    value={suggestionText}
                    onChange={(e) => setSuggestionText(e.target.value)}
                    placeholder="Any suggestions for improvement? (optional)..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4 h-20 resize-none bg-slate-50"
                  ></textarea>
                  <div className="flex gap-3 flex-col md:flex-row">
                    <button
                      onClick={handleFeedbackSubmit}
                      disabled={actionLoading || stars === 0}
                      className="w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Feedback"}
                    </button>
                    <button
                      onClick={handleFeedbackSkip}
                      disabled={actionLoading}
                      className="w-full md:w-auto px-8 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      Skip & Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RESOLUTION PROOF DISPLAY FOR NON-WORKER/OFFICER/CITIZEN IF NEEDED */}
      {!isOfficer && !isAssignedWorker && report.resolutionImageUrl && report.status === 'Resolved' && !isReporter && (
        <div className="w-full max-w-[1200px] mx-auto px-6 mb-4">
          <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-4">Resolution Proof</h3>
            <div className="relative rounded-xl overflow-hidden bg-slate-100 aspect-video mb-4 max-w-2xl">
              <img src={report.resolutionImageUrl} alt="Resolution" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

