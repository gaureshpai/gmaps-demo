'use client'
import LocationSelector from "@/components/googlemap";

export default function Home() {
  return (
    <>
    <div>
      <LocationSelector nextStep={() => {}} prevStep={() => {}}/>
    </div>
    </>
  );
}
