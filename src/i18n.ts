import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type LanguageCode = 'en' | 'hi' | 'ta' | 'mr';

export interface LanguageOption {
  code: LanguageCode;
  shortLabel: string;
  nativeLabel: string;
  englishName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', shortLabel: 'EN', nativeLabel: 'English', englishName: 'English' },
  { code: 'hi', shortLabel: 'हिं', nativeLabel: 'हिन्दी', englishName: 'Hindi' },
  { code: 'ta', shortLabel: 'த', nativeLabel: 'தமிழ்', englishName: 'Tamil' },
  { code: 'mr', shortLabel: 'म', nativeLabel: 'मराठी', englishName: 'Marathi' }
];

const STORAGE_KEY = 'aerocheck_lang';

const EN_DICT = {
  // Navigation & Header
  nav_overview: 'Overview',
  nav_auditor: 'Site Auditor',
  nav_analytics: 'Data Analysis',
  nav_methodology: 'Physics Model',
  search_placeholder: 'Search Indian city or lat, lon...',
  light_mode: 'Light Mode',
  dark_mode: 'Dark Mode',
  export_pdf: 'Export PDF',
  language_label: 'Language',

  // Hero 3D Stage
  hero_active_site: 'ACTIVE REFERENCE SITE',
  hero_cutaway_badge: 'INTERNAL MECHANICS CUTAWAY',
  hero_anemometer: 'ANEMOMETER TELEMETRY',
  hero_live_wind: 'LIVE WIND',
  hero_era5_avg: 'ERA5 AVG',
  hero_subhead: 'INDIA MICRO-WIND VS. SOLAR PV FEASIBILITY AUDITOR',
  hero_desc_default:
    'Scroll to inspect the internal turbine drivetrain cutaway, then benchmark micro-wind against rooftop solar PV across India.',
  btn_inspect_cutaway: 'Inspect Cutaway',
  btn_reset_view: 'Reset View',
  btn_launch_auditor: 'LAUNCH AUDITOR',
  btn_controls_open: '3D Turbine Controls & Cutaway',
  btn_controls_hide: 'Hide 3D Controls',
  dock_sliders: 'Turbine & Cutaway',
  dock_camera: 'Camera Angles',
  dock_presets: 'Reference Sites',
  dock_compare: 'Compare',
  dock_comparing: 'Comparing',
  dock_reset: 'Reset',
  cam_rotor: 'Nacelle / Stator',
  cam_overview: 'Dual Twin Overview',
  cam_solar: 'Same-Budget Solar',
  cam_corridor: 'Aerial Streamlines',
  hawt_label: '3-Blade HAWT',
  vawt_label: 'Helical VAWT',

  // Workspace Headings
  ws_tag: '01. SITE FEASIBILITY WORKSPACE',
  ws_title: 'Interactive Site Auditor',
  btn_compare_locations: 'Compare 2 Locations',
  btn_close_comparison: 'Close Baseline Comparison',
  btn_refresh_era5: 'Refresh Open-Meteo ERA5',
  btn_fetching_era5: 'Fetching ERA5 Archive...',

  // Telemetry & Verdict
  analytics_tag: '02. GENERATION TELEMETRY & FINANCIAL IMPACT',
  analytics_title: 'Hourly Wind Distribution, Solar Setup & 20-Year Return',
  verdict_heading_prefix: 'Engineering Feasibility Verdict',
  verdict_badge_wind: 'RECOMMENDED: INSTALL MICRO-WIND TURBINE',
  verdict_badge_hybrid: 'WIND TURBINE VIABLE · INSTALL WIND OR HYBRID',
  verdict_badge_marginal: 'RECOMMENDED: ROOFTOP SOLAR PRIMARY (+ OPTIONAL WIND HYBRID)',
  verdict_badge_nogo: 'RECOMMENDED: INSTALL ROOFTOP SOLAR PANELS ONLY',
  verdict_compare_baseline: 'Compare Baseline',
  verdict_comparing: 'Comparing Sites',
  verdict_copy: 'Copy Summary',
  verdict_copied: 'Copied',
  verdict_solar_adv: 'Solar Advantage vs. Wind',
  verdict_wind_adv: 'Wind Advantage vs. Solar',

  // KPI Grid
  kpi_hub_wind: 'Avg Hub Wind Speed',
  kpi_wind_output: 'Annual Wind Output',
  kpi_solar_output: 'Same-Budget Solar Output',
  kpi_solar_adv: 'Solar Advantage',
  kpi_wind_adv: 'Wind Advantage',
  kpi_cap_factor: 'Cap. Factor',
  kpi_pv_size: 'PV Size',
  kpi_savings: 'Savings',
  kpi_solar_payback: 'Solar Payback',
  kpi_wind_payback: 'Wind Payback',

  // Controls Sidebar
  ctrl_title: 'Turbine & System Configuration',
  ctrl_subtitle: 'Live hardware calibration & Hellmann shear modeling',
  ctrl_reset: 'Reset',
  ctrl_arch: 'Turbine Architecture',
  ctrl_hub_height: 'Hub Height',
  ctrl_rotor_diam: 'Rotor Diameter',
  ctrl_rated_power: 'Rated Power',
  ctrl_budget: 'Turbine Budget',
  ctrl_tariff: 'Electricity Tariff',
  ctrl_terrain: 'Terrain Roughness (Hellmann Shear)',

  // Map Panel
  map_kicker: 'India Site Telemetry Map',
  map_title: 'Rooftop Spatial Satellite Scanner',
  map_subtitle: 'Click map or drag pin to audit any Indian rooftop',
  map_orbit_start: '3D Orbit',
  map_orbit_stop: 'Orbiting',
  map_locate: 'Locate Rooftop',
  map_locating: 'Locating...',
  map_gps_live: 'GPS Live',
  map_surround: '360° Surround View',
  map_all_sites: 'All Sites',

  // Grounding & Intelligence
  ground_maps_title: 'Local Solar Installers & Terrain',
  ground_maps_btn: 'Scan Nearby Places',
  ground_maps_loading: 'Scanning Maps...',
  ground_subsidy_title: 'PM Surya Ghar Subsidies & Net-Metering',
  ground_subsidy_btn: 'Check Live Subsidies',
  ground_subsidy_loading: 'Searching Subsidies...',

  // Footer & 404
  footer_subtitle: 'India Micro-Wind vs. Same-Budget Solar PV Feasibility Auditor',
  notfound_title: 'Coordinate Off-Grid',
  notfound_home: 'Return to Site Auditor',
  notfound_method: 'Open Physics Model'
} as const;

export type TranslationKey = keyof typeof EN_DICT;

const HI_DICT: Partial<Record<TranslationKey, string>> = {
  nav_overview: 'अवलोकन',
  nav_auditor: 'साइट ऑडिटर',
  nav_analytics: 'डेटा विश्लेषण',
  nav_methodology: 'भौतिकी मॉडल',
  search_placeholder: 'भारतीय शहर या अक्षांश, देशांतर खोजें...',
  light_mode: 'लाइट मोड',
  dark_mode: 'डार्क मोड',
  export_pdf: 'PDF निर्यात',
  language_label: 'भाषा',

  hero_active_site: 'सक्रिय संदर्भ स्थल',
  hero_cutaway_badge: 'आंतरिक यांत्रिक कटअवे',
  hero_anemometer: 'एनीमोमीटर टेलीमेट्री',
  hero_live_wind: 'लाइव हवा',
  hero_era5_avg: 'ERA5 औसत',
  hero_subhead: 'भारत माइक्रो-विंड बनाम सोलर पीवी व्यवहार्यता ऑडिटर',
  hero_desc_default:
    'टरबाइन ड्राइवट्रेन कटअवे देखने के लिए स्क्रॉल करें, और भारत भर में छत पर सौर पीवी से माइक्रो-विंड की तुलना करें।',
  btn_inspect_cutaway: 'कटअवे देखें',
  btn_reset_view: 'व्यू रीसेट',
  btn_launch_auditor: 'ऑडिटर खोलें',
  btn_controls_open: '3D टरबाइन नियंत्रण और कटअवे',
  btn_controls_hide: '3D नियंत्रण छुपाएं',
  dock_sliders: 'टरबाइन और कटअवे',
  dock_camera: 'कैमरा एंगल',
  dock_presets: 'प्रमुख स्थान',
  dock_compare: 'तुलना',
  dock_comparing: 'तुलना सक्रिय',
  dock_reset: 'रीसेट',
  cam_rotor: 'नैसेल / स्टेटर',
  cam_overview: 'दोनों मॉडल साथ',
  cam_solar: 'समान बजट सोलर',
  cam_corridor: 'हवाई प्रवाह दृश्य',
  hawt_label: '3-ब्लेड HAWT',
  vawt_label: 'हेलिकल VAWT',

  ws_tag: '01. साइट व्यवहार्यता कार्यक्षेत्र',
  ws_title: 'इंटरैक्टिव साइट ऑडिटर',
  btn_compare_locations: '2 स्थानों की तुलना करें',
  btn_close_comparison: 'तुलना बंद करें',
  btn_refresh_era5: 'Open-Meteo ERA5 रिफ्रेश करें',
  btn_fetching_era5: 'ERA5 डेटा लोड हो रहा है...',

  analytics_tag: '02. ऊर्जा उत्पादन और वित्तीय प्रभाव',
  analytics_title: 'प्रति घंटा पवन वितरण, सोलर सेटअप और 20-वर्षीय रिटर्न',
  verdict_heading_prefix: 'इंजीनियरिंग व्यवहार्यता निष्कर्ष',
  verdict_badge_wind: 'अनुशंसित: माइक्रो-विंड टरबाइन लगाएं',
  verdict_badge_hybrid: 'पवन ऊर्जा व्यवहार्य · विंड या हाइब्रिड लगाएं',
  verdict_badge_marginal: 'अनुशंसित: रूफटॉप सोलर प्राथमिक (+ वैकल्पिक विंड)',
  verdict_badge_nogo: 'अनुशंसित: केवल रूफटॉप सोलर पैनल लगाएं',
  verdict_compare_baseline: 'बेसलाइन तुलना',
  verdict_comparing: 'तुलना जारी',
  verdict_copy: 'सारांश कॉपी करें',
  verdict_copied: 'कॉपी हो गया',
  verdict_solar_adv: 'सोलर बनाम विंड बढ़त',
  verdict_wind_adv: 'विंड बनाम सोलर बढ़त',

  kpi_hub_wind: 'औसत हब पवन गति',
  kpi_wind_output: 'वार्षिक पवन उत्पादन',
  kpi_solar_output: 'समान-बजट सोलर उत्पादन',
  kpi_solar_adv: 'सोलर बढ़त',
  kpi_wind_adv: 'पवन बढ़त',
  kpi_cap_factor: 'क्षमता कारक',
  kpi_pv_size: 'PV क्षमता',
  kpi_savings: 'बचत',
  kpi_solar_payback: 'सोलर पेबैक',
  kpi_wind_payback: 'विंड पेबैक',

  ctrl_title: 'टरबाइन और सिस्टम कॉन्फ़िगरेशन',
  ctrl_subtitle: 'लाइव हार्डवेयर कैलिब्रेशन और विंड शियर मॉडलिंग',
  ctrl_reset: 'रीसेट',
  ctrl_arch: 'टरबाइन संरचना',
  ctrl_hub_height: 'हब ऊंचाई',
  ctrl_rotor_diam: 'रोटर व्यास',
  ctrl_rated_power: 'रेटेड पावर',
  ctrl_budget: 'टरबाइन बजट',
  ctrl_tariff: 'बिजली दर',
  ctrl_terrain: 'भूभाग खुरदरापन (Hellmann Shear)',

  map_kicker: 'भारत साइट टेलीमेट्री मानचित्र',
  map_title: 'रूफटॉप सैटेलाइट स्कैनर',
  map_subtitle: 'किसी भी भारतीय छत का ऑडिट करने के लिए मैप पर क्लिक करें',
  map_orbit_start: '3D ऑर्बिट',
  map_orbit_stop: 'घूम रहा है',
  map_locate: 'लोकेशन खोजें',
  map_locating: 'खोज रहे हैं...',
  map_gps_live: 'GPS लाइव',
  map_surround: '360° आसपास का दृश्य',
  map_all_sites: 'सभी स्थान',

  ground_maps_title: 'स्थानीय सोलर इंस्टॉलर और भूभाग',
  ground_maps_btn: 'नजदीकी सेवाएं खोजें',
  ground_maps_loading: 'मैप्स स्कैन हो रहा है...',
  ground_subsidy_title: 'PM सूर्य घर सब्सिडी और नेट-मीटरिंग',
  ground_subsidy_btn: 'लाइव सब्सिडी देखें',
  ground_subsidy_loading: 'सब्सिडी खोज रहे हैं...',

  footer_subtitle: 'भारत माइक्रो-विंड बनाम समान-बजट सोलर पीवी ऑडिटर',
  notfound_title: 'निर्देशांक नहीं मिला',
  notfound_home: 'साइट ऑडिटर पर लौटें',
  notfound_method: 'भौतिकी मॉडल खोलें'
};

const TA_DICT: Partial<Record<TranslationKey, string>> = {
  nav_overview: 'மேலோட்டம்',
  nav_auditor: 'தள தணிக்கை',
  nav_analytics: 'தரவு பகுப்பாய்வு',
  nav_methodology: 'இயற்பியல் மாதிரி',
  search_placeholder: 'இந்திய நகரம் அல்லது அட்சரேகை, தீர்க்கரேகை...',
  light_mode: 'லைட் பயன்முறை',
  dark_mode: 'டார்க் பயன்முறை',
  export_pdf: 'PDF ஏற்றுமதி',
  language_label: 'மொழி',

  hero_active_site: 'செயலில் உள்ள இடம்',
  hero_cutaway_badge: 'உட்புற இயந்திர அமைப்பு',
  hero_anemometer: 'காற்று வேக அளவீடு',
  hero_live_wind: 'நேரடி காற்று',
  hero_era5_avg: 'ERA5 சராசரி',
  hero_subhead: 'இந்தியா மைக்ரோ-காற்றாலை மற்றும் சூரிய மின்சக்தி தணிக்கையாளர்',
  hero_desc_default:
    'டர்பைன் உட்புற அமைப்பைக் காண கீழே செல்லவும் மற்றும் இந்திய நகரங்களில் கூரை சூரிய மின்சக்தியுடன் ஒப்பிடவும்.',
  btn_inspect_cutaway: 'உட்புறம் காண்க',
  btn_reset_view: 'மீட்டமை',
  btn_launch_auditor: 'தணிக்கையைத் தொடங்கு',
  btn_controls_open: '3D டர்பைன் கட்டுப்பாடுகள்',
  btn_controls_hide: '3D கட்டுப்பாடுகளை மறை',
  dock_sliders: 'டர்பைன் & அமைப்பு',
  dock_camera: 'கேமரா கோணங்கள்',
  dock_presets: 'முக்கிய தளங்கள்',
  dock_compare: 'ஒப்பிடு',
  dock_comparing: 'ஒப்பீடு செயல்',
  dock_reset: 'மீட்டமை',
  cam_rotor: 'ஸ்டேட்டர் பார்வை',
  cam_overview: 'இரு மாதிரி பார்வை',
  cam_solar: 'சம பட்ஜெட் சோலார்',
  cam_corridor: 'காற்றோட்ட பார்வை',
  hawt_label: '3-பிளேடு HAWT',
  vawt_label: 'ஹெலிகல் VAWT',

  ws_tag: '01. தள சாத்தியக்கூறு பணியகம்',
  ws_title: 'நேரடி தள தணிக்கையாளர்',
  btn_compare_locations: '2 இடங்களை ஒப்பிடுக',
  btn_close_comparison: 'ஒப்பீட்டை மூடு',
  btn_refresh_era5: 'Open-Meteo ERA5 புதுப்பி',
  btn_fetching_era5: 'ERA5 தரவு ஏற்றப்படுகிறது...',

  analytics_tag: '02. மின் உற்பத்தி & நிதி தாக்கம்',
  analytics_title: 'மணிநேர காற்று விநியோகம், சோலார் & 20 ஆண்டு வருமானம்',
  verdict_heading_prefix: 'பொறியியல் சாத்தியக்கூறு முடிவு',
  verdict_badge_wind: 'பரிந்துரை: மைக்ரோ-காற்றாலை நிறுவவும்',
  verdict_badge_hybrid: 'காற்றாலை சாத்தியம் · காற்று அல்லது ஹைப்ரிட்',
  verdict_badge_marginal: 'பரிந்துரை: கூரை சோலார் முதன்மை (+ காற்று விருப்பம்)',
  verdict_badge_nogo: 'பரிந்துரை: கூரை சோலார் பேனல் மட்டும் நிறுவவும்',
  verdict_compare_baseline: 'அடிப்படை ஒப்பீடு',
  verdict_comparing: 'ஒப்பிடப்படுகிறது',
  verdict_copy: 'சுருக்கம் நகலெடு',
  verdict_copied: 'நகலெடுக்கப்பட்டது',
  verdict_solar_adv: 'காற்றை விட சோலார் முன்னிலை',
  verdict_wind_adv: 'சோலாரை விட காற்று முன்னிலை',

  kpi_hub_wind: 'சராசரி ஹப் காற்று வேகம்',
  kpi_wind_output: 'ஆண்டு காற்று உற்பத்தி',
  kpi_solar_output: 'சம-பட்ஜெட் சோலார் உற்பத்தி',
  kpi_solar_adv: 'சோலார் நன்மை',
  kpi_wind_adv: 'காற்று நன்மை',
  kpi_cap_factor: 'திறன் காரணி',
  kpi_pv_size: 'PV அளவு',
  kpi_savings: 'சேமிப்பு',
  kpi_solar_payback: 'சோலார் மீட்பு',
  kpi_wind_payback: 'காற்று மீட்பு',

  ctrl_title: 'டர்பைன் & அமைப்பு கட்டமைப்பு',
  ctrl_subtitle: 'நேரடி அளவீடு & ஹெல்மேன் காற்று சரிவு மாதிரி',
  ctrl_reset: 'மீட்டமை',
  ctrl_arch: 'டர்பைன் வகை',
  ctrl_hub_height: 'ஹப் உயரம்',
  ctrl_rotor_diam: 'ரோட்டர் விட்டம்',
  ctrl_rated_power: 'அதிகபட்ச திறன்',
  ctrl_budget: 'முதலீட்டு பட்ஜெட்',
  ctrl_tariff: 'மின் கட்டணம்',
  ctrl_terrain: 'நிலப்பரப்பு கரடுமுரடு',

  map_kicker: 'இந்தியா தள வரைபடம்',
  map_title: 'செயற்கைக்கோள் கூரை ஸ்கேனர்',
  map_subtitle: 'எந்த இந்திய கூரையையும் தணிக்கை செய்ய கிளிக் செய்யவும்',
  map_orbit_start: '3D சுற்றுப்பாதை',
  map_orbit_stop: 'சுற்றுகிறது',
  map_locate: 'இடத்தைக் கண்டறி',
  map_locating: 'தேடுகிறது...',
  map_gps_live: 'GPS நேரலை',
  map_surround: '360° சுற்றளவு பார்வை',
  map_all_sites: 'அனைத்து இடங்கள்',

  ground_maps_title: 'உள்ளூர் சோலார் நிறுவிகள் & நிலப்பரப்பு',
  ground_maps_btn: 'அருகிலுள்ளவற்றை தேடு',
  ground_maps_loading: 'வரைபடம் தேடுகிறது...',
  ground_subsidy_title: 'PM சூர்யா கர் மானியம் & நெட்-மீட்டரிங்',
  ground_subsidy_btn: 'நேரடி மானியம் பார்',
  ground_subsidy_loading: 'மானியம் தேடுகிறது...',

  footer_subtitle: 'இந்தியா மைக்ரோ-காற்றாலை மற்றும் சம-பட்ஜெட் சோலார் தணிக்கையாளர்',
  notfound_title: 'பாதை கிடைக்கவில்லை',
  notfound_home: 'தணிக்கையாளருக்குத் திரும்பு',
  notfound_method: 'இயற்பியல் மாதிரி திற'
};

const MR_DICT: Partial<Record<TranslationKey, string>> = {
  nav_overview: 'आढावा',
  nav_auditor: 'साइट ऑडिटर',
  nav_analytics: 'डेटा विश्लेषण',
  nav_methodology: 'भौतिकशास्त्र मॉडेल',
  search_placeholder: 'भारतीय शहर किंवा अक्षांश, रेखांश शोधा...',
  light_mode: 'लाइट मोड',
  dark_mode: 'डार्क मोड',
  export_pdf: 'PDF डाउनलोड',
  language_label: 'भाषा',

  hero_active_site: 'सक्रिय संदर्भ ठिकाण',
  hero_cutaway_badge: 'अंतर्गत यांत्रिक कटअवे',
  hero_anemometer: 'ॲनिमोमीटर टेलीमेट्री',
  hero_live_wind: 'थेट वारा',
  hero_era5_avg: 'ERA5 सरासरी',
  hero_subhead: 'भारत मायक्रो-विंड विरुद्ध सोलर पीव्ही व्यवहार्यता ऑडिटर',
  hero_desc_default:
    'टरबाइनचे अंतर्गत भाग पाहण्यासाठी स्क्रोल करा आणि संपूर्ण भारतातील छतावरील सोलर पीव्हीशी तुलना करा.',
  btn_inspect_cutaway: 'अंतर्गत रचना पहा',
  btn_reset_view: 'व्ह्यू रीसेट',
  btn_launch_auditor: 'ऑडिटर सुरू करा',
  btn_controls_open: '3D टरबाइन नियंत्रणे',
  btn_controls_hide: '3D नियंत्रणे लपवा',
  dock_sliders: 'टरबाइन व कटअवे',
  dock_camera: 'कॅमेरा अँगल',
  dock_presets: 'प्रमुख ठिकाणे',
  dock_compare: 'तुलना',
  dock_comparing: 'तुलना चालू',
  dock_reset: 'रीसेट',
  cam_rotor: 'नॅसेल / स्टेटर',
  cam_overview: 'दोन्ही मॉडेल सोबत',
  cam_solar: 'समान बजेट सोलर',
  cam_corridor: 'हवेचा प्रवाह दृश्य',
  hawt_label: '3-ब्लेड HAWT',
  vawt_label: 'हेलिकल VAWT',

  ws_tag: '01. साइट व्यवहार्यता कार्यक्षेत्र',
  ws_title: 'इंटरॲक्टिव्ह साइट ऑडिटर',
  btn_compare_locations: '2 ठिकाणांची तुलना करा',
  btn_close_comparison: 'तुलना बंद करा',
  btn_refresh_era5: 'Open-Meteo ERA5 रिफ्रेश',
  btn_fetching_era5: 'ERA5 डेटा आणत आहे...',

  analytics_tag: '02. वीज निर्मिती व आर्थिक प्रभाव',
  analytics_title: 'तासानुसार पवन वितरण, सोलर सेटअप आणि 20 वर्षांचा परतावा',
  verdict_heading_prefix: 'अभियांत्रिकी व्यवहार्यता निष्कर्ष',
  verdict_badge_wind: 'शिफारस: मायक्रो-विंड टरबाइन बसवा',
  verdict_badge_hybrid: 'पवन ऊर्जा योग्य · विंड किंवा हायब्रिड बसवा',
  verdict_badge_marginal: 'शिफारस: रूफटॉप सोलर प्राधान्य (+ ऐच्छिक विंड)',
  verdict_badge_nogo: 'शिफारस: फक्त रूफटॉप सोलर पॅनेल बसवा',
  verdict_compare_baseline: 'बेसलाइन तुलना',
  verdict_comparing: 'तुलना सुरू',
  verdict_copy: 'सारांश कॉपी करा',
  verdict_copied: 'कॉपी झाले',
  verdict_solar_adv: 'वाऱ्यापेक्षा सोलरची आघाडी',
  verdict_wind_adv: 'सोलरपेक्षा वाऱ्याची आघाडी',

  kpi_hub_wind: 'सरासरी हब वाऱ्याचा वेग',
  kpi_wind_output: 'वार्षिक पवन उत्पादन',
  kpi_solar_output: 'समान-बजेट सोलर उत्पादन',
  kpi_solar_adv: 'सोलर फायदा',
  kpi_wind_adv: 'पवन फायदा',
  kpi_cap_factor: 'क्षमता घटक',
  kpi_pv_size: 'PV क्षमता',
  kpi_savings: 'बचत',
  kpi_solar_payback: 'सोलर परतावा',
  kpi_wind_payback: 'विंड परतावा',

  ctrl_title: 'टरबाइन व सिस्टम सेटिंग्ज',
  ctrl_subtitle: 'थेट हार्डवेअर कॅलिब्रेशन आणि विंड शियर मॉडेलिंग',
  ctrl_reset: 'रीसेट',
  ctrl_arch: 'टरबाइन प्रकार',
  ctrl_hub_height: 'हब उंची',
  ctrl_rotor_diam: 'रोटर व्यास',
  ctrl_rated_power: 'रेटेड क्षमता',
  ctrl_budget: 'टरबाइन बजेट',
  ctrl_tariff: 'वीज दर',
  ctrl_terrain: 'भूप्रदेश खडबडीतपणा',

  map_kicker: 'भारत साइट टेलीमेट्री नकाशा',
  map_title: 'रूफटॉप सॅटेलाइट स्कॅनर',
  map_subtitle: 'कोणत्याही भारतीय छताचे ऑडिट करण्यासाठी नकाशावर क्लिक करा',
  map_orbit_start: '3D ऑर्बिट',
  map_orbit_stop: 'फिरत आहे',
  map_locate: 'ठिकाण शोधा',
  map_locating: 'शोधत आहे...',
  map_gps_live: 'GPS लाइव्ह',
  map_surround: '360° परिसर दृश्य',
  map_all_sites: 'सर्व ठिकाणे',

  ground_maps_title: 'स्थानिक सोलर इंस्टॉलर व परिसर',
  ground_maps_btn: 'जवळचे सेवा केंद्र शोधा',
  ground_maps_loading: 'नकाशा स्कॅन होत आहे...',
  ground_subsidy_title: 'PM सूर्य घर सबसिडी व नेट-मीटरिंग',
  ground_subsidy_btn: 'थेट सबसिडी पहा',
  ground_subsidy_loading: 'सबसिडी शोधत आहे...',

  footer_subtitle: 'भारत मायक्रो-विंड विरुद्ध समान-बजेट सोलर पीव्ही ऑडिटर',
  notfound_title: 'ठिकाण आढळले नाही',
  notfound_home: 'साइट ऑडिटरकडे परत जा',
  notfound_method: 'भौतिकशास्त्र मॉडेल उघडा'
};

const DICTIONARIES: Record<LanguageCode, Partial<Record<TranslationKey, string>>> = {
  en: EN_DICT,
  hi: HI_DICT,
  ta: TA_DICT,
  mr: MR_DICT
};

export function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'ta' || saved === 'mr')) {
      return saved;
    }
  } catch {
    // Ignore storage restriction
  }
  return 'en';
}

export function translateText(lang: LanguageCode, key: TranslationKey): string {
  return DICTIONARIES[lang]?.[key] || EN_DICT[key];
}

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => EN_DICT[key]
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);

  const setLanguage = useCallback((nextLang: LanguageCode) => {
    setLanguageState(nextLang);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, nextLang);
      } catch {
        // Ignore storage error
      }
      document.documentElement.lang = nextLang;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback((key: TranslationKey) => translateText(language, key), [language]);

  return React.createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, t } },
    children
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}
