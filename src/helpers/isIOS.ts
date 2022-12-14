export const isIOS = () => {
  var iosQuirkPresent = function () {
    var audio = new Audio();

    audio.volume = 0.5;
    return audio.volume === 1; // volume cannot be changed from "1" on iOS 12 and below
  };

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var isAppleDevice = navigator.userAgent.includes("Macintosh");
  var isTouchScreen = navigator.maxTouchPoints >= 1; // true for iOS 13 (and hopefully beyond)

  return isIOS || (isAppleDevice && (isTouchScreen || iosQuirkPresent()));
};
