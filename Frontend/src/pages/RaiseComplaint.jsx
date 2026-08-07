import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { 
  AlertCircle, 
  Upload, 
  CheckCircle2, 
  ArrowLeft, 
  Zap, 
  Wrench, 
  Sparkles, 
  Wifi, 
  Home, 
  HelpCircle,
  X
} from "lucide-react";

const CATEGORIES = [
  { id: "Electrical", label: "Electrical", icon: Zap, color: "text-amber-700 bg-amber-50 border-amber-200" },
  { id: "Plumbing", label: "Plumbing", icon: Wrench, color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  { id: "Cleanliness", label: "Cleanliness", icon: Sparkles, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { id: "Wifi / Network", label: "WiFi / Network", icon: Wifi, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  { id: "Furniture", label: "Furniture", icon: Home, color: "text-purple-700 bg-purple-50 border-purple-200" },
  { id: "Other", label: "Other", icon: HelpCircle, color: "text-slate-700 bg-slate-100 border-slate-200" },
];

const RaiseComplaint = () => {
  const navigate = useNavigate();
  const [type, setType] = useState("Electrical");
  const [room, setRoom] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!room || !description) {
      setError("Please fill in room number and description.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("room", room);
      formData.append("description", description);
      if (imageFile) {
        formData.append("image", imageFile);
      }

      await api.post("/api/complaints/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      navigate("/student/complaints");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to submit complaint.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      
      <Link
        to="/student/complaints"
        className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Complaints</span>
      </Link>

      <div className="ui-panel p-6 sm:p-8 rounded-2xl bg-white border-slate-200 shadow-xs">
        
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Raise Maintenance Complaint
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Submit a room maintenance ticket for hostel staff resolution.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const selected = type === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setType(cat.id)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      selected
                        ? "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs font-bold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-xs">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room Number Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Room Number / Location
            </label>
            <input
              type="text"
              required
              placeholder="e.g. B-302"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Issue Description
            </label>
            <textarea
              required
              rows={4}
              placeholder="Explain the problem in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs resize-none"
            />
          </div>

          {/* Photo Attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Attach Photo Proof (Optional)
            </label>

            {imagePreview ? (
              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-slate-300">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="border border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all text-center">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">Click to upload photo</span>
                <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, JPEG up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Submitting Ticket..." : "Submit Complaint"}
          </button>

        </form>

      </div>
    </div>
  );
};

export default RaiseComplaint;
