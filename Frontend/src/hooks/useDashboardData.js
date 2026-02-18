import { useState, useEffect } from 'react';
import axios from 'axios';

const useDashboardData = () => {
    const [complaintsCount, setComplaintsCount] = useState(0);
    const [todaysMess, setTodaysMess] = useState(null);
    const [leaveStatus, setLeaveStatus] = useState("No recent leaves");
    const [studentName, setStudentName] = useState("Student"); // Default name
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const config = { headers: { Authorization: `Bearer ${token}` } };

                // 0. Fetch Student Profile (Name)
                try {
                    // Try to fetch profile. If endpoint differs, it might fail, catch freely.
                    // Common pattern: /api/student/profile or /api/auth/me
                    const profileRes = await axios.get("http://localhost:5000/api/student/profile", config);
                    if (profileRes.data && profileRes.data.student && profileRes.data.student.name) {
                        setStudentName(profileRes.data.student.name);
                    } else if (profileRes.data && profileRes.data.name) {
                        setStudentName(profileRes.data.name);
                    }
                } catch (err) {
                    console.error("Error fetching profile:", err);
                    // Fallback to localStorage if available
                    // const storedName = localStorage.getItem("studentName");
                    // if(storedName) setStudentName(storedName);
                }

                // 1. Fetch Complaints Count
                try {
                    const complaintRes = await axios.get("http://localhost:5000/api/complaints/my", config);
                    // Assuming the API returns an array of complaints
                    let activeComplaints = []
                    if (Array.isArray(complaintRes.data)) {
                        activeComplaints = complaintRes.data.filter(c => c.status !== "Resolved");
                    } else if (complaintRes.data.complaints && Array.isArray(complaintRes.data.complaints)) {
                        activeComplaints = complaintRes.data.complaints.filter(c => c.status !== "Resolved");
                    }
                    setComplaintsCount(activeComplaints.length);
                } catch (err) {
                    console.error("Error fetching complaints:", err);
                }

                // 2. Fetch Today's Mess Menu
                try {
                    const messRes = await axios.get("http://localhost:5000/api/mess/today", config);
                    setTodaysMess(messRes.data);
                } catch (err) {
                    console.error("Error fetching mess menu:", err);
                }

                // 3. Fetch Leave Status
                try {
                    const leaveRes = await axios.get("http://localhost:5000/api/leave/mine", config);
                    // Get the latest leave application
                    if (leaveRes.data && leaveRes.data.length > 0) {
                        // Assuming the API returns requests in chronological order (oldest first), 
                        // the last one is the latest.
                        const latestLeave = leaveRes.data[leaveRes.data.length - 1];
                        setLeaveStatus(latestLeave.status);
                    }
                } catch (err) {
                    console.error("Error fetching leaves:", err);
                }

            } catch (error) {
                console.error("Dashboard data fetch error", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { complaintsCount, todaysMess, leaveStatus, studentName, loading };
};

export default useDashboardData;
