import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { 
  FaApple, 
  FaChrome, 
  FaStrava, 
  FaWhatsapp, 
  FaGoogle, 
  FaTelegram 
} from "react-icons/fa";
import { SiFlipkart } from "react-icons/si";

export function InfiniteSliderBasic() {
  return (
    <div className="w-full flex flex-col items-center justify-center py-8">
      <h2 className="text-xl font-bold mb-4">We provide OTP for:</h2>
      <InfiniteSlider 
        gap={24} 
        reverse 
        className="max-w-[1200px]"
      >
        <div className="flex flex-col items-center">
          <FaApple 
            className="h-[24px] w-auto text-gray-800 hover:text-black transition-colors duration-300" 
            aria-label="Apple Music logo" 
          />
          <span className="text-sm">Apple Music</span>
        </div>
        <div className="flex flex-col items-center">
          <FaChrome 
            className="h-[24px] w-auto text-blue-500 hover:text-blue-600 transition-colors duration-300" 
            aria-label="Chrome logo" 
          />
          <span className="text-sm">Chrome</span>
        </div>
        <div className="flex flex-col items-center">
          <FaStrava 
            className="h-[24px] w-auto text-orange-500 hover:text-orange-600 transition-colors duration-300" 
            aria-label="Strava logo" 
          />
          <span className="text-sm">Strava</span>
        </div>
        <div className="flex flex-col items-center">
          <FaWhatsapp 
            className="h-[24px] w-auto text-green-500 hover:text-green-600 transition-colors duration-300" 
            aria-label="WhatsApp logo" 
          />
          <span className="text-sm">WhatsApp</span>
        </div>
        <div className="flex flex-col items-center">
          <FaGoogle 
            className="h-[24px] w-auto text-red-500 hover:text-red-600 transition-colors duration-300" 
            aria-label="Gmail logo" 
          />
          <span className="text-sm">Gmail</span>
        </div>
        <div className="flex flex-col items-center">
          <SiFlipkart 
            className="h-[24px] w-auto text-yellow-500 hover:text-yellow-600 transition-colors duration-300" 
            aria-label="Flipkart logo" 
          />
          <span className="text-sm">Flipkart</span>
        </div>
        <div className="flex flex-col items-center">
          <FaTelegram 
            className="h-[24px] w-auto text-blue-400 hover:text-blue-500 transition-colors duration-300" 
            aria-label="Telegram logo" 
          />
          <span className="text-sm">Telegram</span>
        </div>
      </InfiniteSlider>
    </div>
  );
}
