import { useState } from "react";
import { Heart, MapPin, Phone, Calendar, Send } from "lucide-react";
import { Button } from "./ui/button";
import Watermark from "./Watermark";
import EnquiryModal from "./EnquiryModal";

type AnyProp = {
  id: string | number;
  title: string;
  location: string;
  price: string;
  image: string;
  timeAgo: string;
  premium?: boolean;
  isPremium?: boolean;
  isAdminPosted?: boolean;
  plan?: string;
  postedBy?: { role?: string };
  createdBy?: { role?: string };
  ownerRole?: string;
  source?: string;
};

const featuredProperties: AnyProp[] = [
  {
    id: 1,
    title: "3 BHK Luxury Apartment",
    location: "Sector 12, Rohtak",
    price: "₹85 Lakh",
    image: "/placeholder.svg",
    timeAgo: "2 hours ago",
    premium: true,
  },
  {
    id: 2,
    title: "Commercial Shop in Main Market",
    location: "Sector 4, Rohtak",
    price: "₹1.2 Crore",
    image: "/placeholder.svg",
    timeAgo: "5 hours ago",
  },
];

const freshRecommendations: AnyProp[] = [
  {
    id: 3,
    title: "2 BHK Builder Floor",
    location: "Sector 15, Rohtak",
    price: "₹65 Lakh",
    image: "/placeholder.svg",
    timeAgo: "1 day ago",
  },
  {
    id: 4,
    title: "Independent House with Garden",
    location: "Sector 8, Rohtak",
    price: "₹1.5 Crore",
    image: "/placeholder.svg",
    timeAgo: "2 days ago",
    premium: true,
  },
  {
    id: 5,
    title: "Plot for Construction",
    location: "Sector 20, Rohtak",
    price: "₹45 Lakh",
    image: "/placeholder.svg",
    timeAgo: "3 days ago",
  },
  {
    id: 6,
    title: "PG Accommodation",
    location: "Sector 6, Rohtak",
    price: "₹8,000/month",
    image: "/placeholder.svg",
    timeAgo: "1 week ago",
  },
];

const isAdminPosted = (p: AnyProp) =>
  Boolean(
    p.isAdminPosted ||
      p.source === "admin" ||
      p.postedBy?.role === "admin" ||
      p.createdBy?.role === "admin" ||
      p.ownerRole === "admin",
  );

const isPremium = (p: AnyProp) =>
  !isAdminPosted(p) &&
  Boolean(
    p.isPremium ||
      p.premium ||
      (typeof p.plan === "string" && p.plan.toLowerCase().includes("premium")),
  );

function Badge({ ap, premium }: { ap?: boolean; premium?: boolean }) {
  if (ap) {
    return (
      <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow">
        AP
      </div>
    );
  }
  if (premium) {
    return (
      <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow">
        [premium]
      </div>
    );
  }
  return null;
}

function FreshCard({
  property,
  onEnquiry,
}: {
  property: AnyProp;
  onEnquiry: (p: AnyProp) => void;
}) {
  const ap = isAdminPosted(property);
  const prem = isPremium(property);
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      <div className="relative aspect-[4/3] bg-gray-100">
        <img
          src={property.image}
          alt={property.title}
          className="w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
        />
        <Badge ap={ap} premium={prem} />
        <button className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
          <Heart className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
            {property.title}
          </h3>
          <span className="text-sm font-bold text-[#C70000] whitespace-nowrap">
            {property.price}
          </span>
        </div>

        <div className="mt-1 flex items-center text-gray-500">
          <MapPin className="h-3.5 w-3.5 mr-1" />
          <span className="text-xs line-clamp-1">{property.location}</span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400 inline-flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {property.timeAgo}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-[#C70000] text-[#C70000]"
              onClick={() => onEnquiry(property)}
              data-testid="enquiry-btn"
            >
              <Send className="h-3 w-3 mr-1" />
              Enquiry
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-[#C70000] text-[#C70000]"
            >
              <Phone className="h-3 w-3 mr-1" />
              Call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PropertyListings() {
  const [enquiryModalOpen, setEnquiryModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  const handleEnquiry = (property: AnyProp) => {
    setSelectedProperty(property);
    setEnquiryModalOpen(true);
  };

  return (
    <div className="bg-white pb-20">
      {/* Fresh Recommendations */}
      <section className="py-4">
        <div className="px-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Fresh Recommendations
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {freshRecommendations.map((property) => (
              <FreshCard
                key={property.id}
                property={property}
                onEnquiry={handleEnquiry}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Ads */}
      <section className="py-4">
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Featured Ads</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#C70000] text-sm"
            >
              See All
            </Button>
          </div>

          <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide">
            {featuredProperties.map((property) => {
              const ap = isAdminPosted(property);
              const prem = isPremium(property);
              return (
                <div
                  key={property.id}
                  className="flex-shrink-0 w-64 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                >
                  <div className="relative">
                    <img
                      src={property.image}
                      alt={property.title}
                      className="w-full h-32 object-cover pointer-events-none select-none"
                    />
                    <Watermark
                      variant="pattern"
                      className="pointer-events-none"
                    />
                    <Badge ap={ap} premium={prem} />
                    <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                      <Heart className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 leading-tight">
                      {property.title}
                    </h3>
                    <div className="flex items-center text-gray-500 mb-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span className="text-sm">{property.location}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#C70000]">
                        {property.price}
                      </span>
                      <span className="text-xs text-gray-400">
                        {property.timeAgo}
                      </span>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-[#C70000] text-[#C70000]"
                        onClick={() => handleEnquiry(property)}
                        data-testid="enquiry-btn"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Enquiry Now
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-[#C70000] hover:bg-[#A60000] text-white"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enquiry Modal */}
      {selectedProperty && (
        <EnquiryModal
          isOpen={enquiryModalOpen}
          onClose={() => {
            setEnquiryModalOpen(false);
            setSelectedProperty(null);
          }}
          propertyId={String(selectedProperty.id)}
          propertyTitle={selectedProperty.title}
          ownerName="Property Owner"
        />
      )}
    </div>
  );
}
