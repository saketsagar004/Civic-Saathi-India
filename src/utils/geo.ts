import { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, GeoPoint } from 'firebase/firestore';

// Helper function to calculate distance between two coordinates in meters
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function checkDuplicateIssue(category: string, lat: number, lng: number) {
  try {
    // We fetch recent reports of the same category.
    // In a real production app we'd use GeoFire or geohashes.
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, where('category', '==', category));
    const querySnapshot = await getDocs(q);
    
    let closestDuplicate = null;
    let minDistance = 100; // Look within 100 meters

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.location && data.location.lat && data.location.lng) {
        const distance = getDistanceFromLatLonInM(lat, lng, data.location.lat, data.location.lng);
        if (distance < minDistance) {
          minDistance = distance;
          closestDuplicate = { id: doc.id, ...data };
        }
      }
    });

    return closestDuplicate;
  } catch (error) {
    console.error("Error checking duplicates:", error);
    return null;
  }
}
