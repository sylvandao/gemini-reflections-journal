'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupportedLanguage } from './types';

export const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string; nativeLabel: string; flag: string; country: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English (US)', flag: '🇺🇸', country: 'United States' },
  { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: '🇻🇳', country: 'Việt Nam' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文 (简体)', flag: '🇨🇳', country: '中国 / 华人地区' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷', country: '대한민국' },
];

/**
 * Detect language based on GPS latitude and longitude coordinates
 */
export function detectLanguageFromCoordinates(lat: number, lng: number): {
  language: SupportedLanguage;
  regionName: string;
  countryCode: string;
} {
  // 1. Vietnam bounds: lat 8.0 - 24.0, lng 102.0 - 110.0
  if (lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0) {
    return { language: 'vi', regionName: 'Việt Nam (Vietnam)', countryCode: 'VN' };
  }

  // 2. South Korea bounds: lat 33.0 - 39.0, lng 124.5 - 131.5
  if (lat >= 33.0 && lat <= 39.0 && lng >= 124.5 && lng <= 131.5) {
    return { language: 'ko', regionName: '대한민국 (South Korea)', countryCode: 'KR' };
  }

  // 3. Greater China / Taiwan / Hong Kong / Macau bounds:
  // Taiwan: lat 21.8 - 25.5, lng 119.5 - 122.5
  // Hong Kong / Macau: lat 22.1 - 22.6, lng 113.8 - 114.5
  // Mainland China: lat 18.0 - 53.6, lng 73.5 - 135.0 (excluding Korea and Vietnam zones handled above)
  if (
    (lat >= 21.8 && lat <= 25.5 && lng >= 119.5 && lng <= 122.5) ||
    (lat >= 22.1 && lat <= 22.6 && lng >= 113.8 && lng <= 114.5) ||
    (lat >= 18.0 && lat <= 53.6 && lng >= 73.5 && lng <= 135.0 && !(lat >= 33.0 && lat <= 39.0 && lng >= 124.5 && lng <= 131.5) && !(lat <= 24.0 && lng <= 110.0))
  ) {
    return { language: 'zh', regionName: '中国 / 港澳台 (China / Region)', countryCode: 'CN' };
  }

  return { language: 'en', regionName: 'Global / English', countryCode: 'US' };
}

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Nav & Brand
    'app.name': 'Gemini Reflections',
    'app.subtitle': 'AI Reflection Partner',
    'nav.entries': 'entries',
    'nav.new_entry': 'New Reflection',
    'nav.history': 'History',
    'nav.voice_agent': 'Voice Agent',
    'nav.weekly_digest': 'Weekly Digest',
    'nav.admin_area': 'Admin Area',
    'nav.sign_in': 'Sign in with Google',
    'nav.sign_out': 'Sign out',
    'nav.language': 'Language',
    'nav.auto_gps': 'Auto GPS',
    'nav.gps_active': 'GPS Active',
    'nav.gps_detected': 'GPS Location Detected',

    // Hero / Landing
    'hero.badge': 'User-Isolated Cloud Firestore Persistence & Firebase Auth',
    'hero.title_prefix': 'Converse, Reflect, and Distill Thoughts with',
    'hero.title_accent': 'Gemini AI',
    'hero.description': 'A private, authenticated sanctuary for multi-turn reflection dialogues. Turn raw journal thoughts into structured insights, executive summaries, and action plans powered by Gemini 3.6 Flash.',
    'hero.cta_google': 'Sign in with Google to Begin',
    'hero.cta_guest': 'Instant Cloud Persistence & Zero Local Data Loss',
    'hero.feature_voice': 'Live Spoken Voice Agent',
    'hero.feature_voice_desc': 'Fluid spoken dialogues with real-time audio playback.',
    'hero.feature_distill': 'Multi-Turn AI Insights',
    'hero.feature_distill_desc': 'Synthesizes realizations, executive summaries, and actionable checklists.',
    'hero.feature_maps': 'GPS Location Pinning',
    'hero.feature_maps_desc': 'Pin your sanctuary or explore location vibes with Google Maps.',

    // Reflection Modes
    'mode.deep_reflection': 'Deep Reflection',
    'mode.deep_reflection_desc': 'Empathetic synthesis of core emotional subtext and personal growth.',
    'mode.socratic_coach': 'Socratic Coach',
    'mode.socratic_coach_desc': 'Probing clarifying questions that challenge assumptions.',
    'mode.brainstorming': 'Creative Brainstorming',
    'mode.brainstorming_desc': 'Lateral thinking, creative analogies, and unexpected possibilities.',
    'mode.action_planning': 'Action Planning',
    'mode.action_planning_desc': 'Transforms reflections into clear, small, high-leverage executable steps.',
    'mode.gratitude_mindfulness': 'Gratitude & Mindfulness',
    'mode.gratitude_mindfulness_desc': 'Anchors in presence, savors wins, and reframes tension.',

    // Entry Editor
    'editor.title_placeholder': 'Name this reflection session...',
    'editor.category_label': 'Category',
    'editor.mood_label': 'Mood',
    'editor.priority_label': 'Priority',
    'editor.pin_location': 'Pin Location',
    'editor.pinned_at': 'Pinned at',
    'editor.prompt_placeholder': 'Type your thought, question, or dilemma (Press Enter to send, Shift+Enter for newline)...',
    'editor.reflect_btn': 'Reflect',
    'editor.distill_btn': 'Distill Insights',
    'editor.distill_update': 'Update AI Insights',
    'editor.saved_status': 'Saved to Firestore',
    'editor.saving_status': 'Saving...',
    'editor.error_status': 'Error saving',
    'editor.empty_state_title': 'Begin your personal reflection dialogue',
    'editor.empty_state_desc': 'Type a thought above or start with one of these introspective prompts:',
    'editor.suggested_1': 'What is currently demanding most of my mental energy, and why?',
    'editor.suggested_2': 'What is an unspoken assumption I am making in a current decision?',
    'editor.suggested_3': 'What small victory or moment of beauty occurred today that I almost overlooked?',
    'editor.listen_aloud': 'Read Aloud with Gemini Voice',
    'editor.dictation_start': 'Start Voice Dictation',
    'editor.dictation_stop': 'Stop Dictation',
    'editor.listening_now': 'Listening to your speech...',
    'editor.export_btn': 'Export',
    'editor.delete_btn': 'Delete Reflection',
    'editor.delete_confirm': 'Are you sure you want to delete this reflection? This cannot be undone.',

    // Insights Panel
    'insights.title': 'Distilled Synthesis & Realizations',
    'insights.summary': 'Executive Summary',
    'insights.key_insights': 'Key Insights & Mindset Shifts',
    'insights.action_items': 'Recommended Action Items',
    'insights.detected_mood': 'Detected Emotional Tone',
    'insights.model_used': 'Synthesized via',

    // History Sidebar
    'sidebar.title': 'Journal History',
    'sidebar.search_placeholder': 'Search reflections, insights, places...',
    'sidebar.all_categories': 'All Categories',
    'sidebar.new_btn': 'New',
    'sidebar.export_all': 'Export All',
    'sidebar.no_entries': 'No reflections found',
    'sidebar.turns_count': 'turns',
    'sidebar.delete_confirm': 'Delete this reflection?',

    // Voice Agent Modal
    'voice.modal_title': 'Live Conversational Voice Agent',
    'voice.status_idle': 'Tap the Voice Orb to start speaking',
    'voice.status_listening': 'Listening to you... Speak freely',
    'voice.status_thinking': 'Gemini is reflecting...',
    'voice.status_speaking': 'Gemini is speaking...',
    'voice.done_speaking': 'Done Speaking',
    'voice.start_speaking': 'Start Speaking',
    'voice.interrupt': 'Tap Orb to Interrupt',
    'voice.transcript_title': 'Live Spoken Transcript',
    'voice.switch_mode': 'Change Reflection Mode',
    'voice.close': 'Close Voice Agent',

    // Weekly Digest Modal
    'digest.modal_title': 'Weekly AI Reflection Digest & Growth Loop',
    'digest.subtitle': 'Synthesize weekly insights, follow up on commitments, and deliver to your channels.',
    'digest.tab_preview': 'Digest Preview',
    'digest.tab_channels': 'Delivery Channels',
    'digest.tab_apps_script': 'Google Apps Script (Gmail)',
    'digest.btn_generate': 'Generate & Send Weekly Digest',
    'digest.btn_save_prefs': 'Save Channel Preferences',
    'digest.core_theme': 'Core Weekly Theme',
    'digest.executive_summary': 'Executive Summary',
    'digest.breakthroughs': 'Key Breakthroughs & Realizations',
    'digest.goal_followups': 'Goal & Commitment Follow-Ups',
    'digest.next_week_question': '🌱 Provocative Question for Next Week',
    'digest.dispatched_success': 'Weekly digest generated and delivered successfully!',

    // Location Picker Modal
    'location.modal_title': 'Location & Ambient Sanctuary Pinning',
    'location.tab_search': 'Search Places',
    'location.tab_gps': 'Current GPS',
    'location.tab_sanctuaries': 'Sanctuary Presets',
    'location.tab_custom': 'Custom Place',
    'location.search_placeholder': 'Search address, cafe, library, park, city...',
    'location.gps_button': 'Detect My Current GPS Location',
    'location.gps_auto_language': 'Auto-detects language based on your GPS country (Vietnam, China, Korea, etc.)',
    'location.remove_pin': 'Remove Pinned Location',
    'location.attach_btn': 'Attach Location',
    'location.gps_presets_title': 'Quick GPS Simulation Presets (Test Language Switch)',

    // Export Modal
    'export.modal_title': 'Export Reflection Archive',
    'export.scope_current': 'Current Reflection',
    'export.scope_all': 'All Reflections',
    'export.format_md': 'Markdown (.md)',
    'export.format_json': 'JSON (.json)',
    'export.copy_btn': 'Copy to Clipboard',
    'export.download_btn': 'Download File',
    'export.copied': 'Copied!',

    // Notifications & Toasts
    'toast.language_changed': 'Language switched to',
    'toast.gps_detected': 'GPS detected location in',
    'toast.gps_error': 'Could not access GPS. Please check location permissions.',
  },

  vi: {
    // Nav & Brand
    'app.name': 'Gemini Reflections',
    'app.subtitle': 'Bạn đồng hành Suy ngẫm AI',
    'nav.entries': 'bài viết',
    'nav.new_entry': 'Viết bài mới',
    'nav.history': 'Lịch sử',
    'nav.voice_agent': 'Trợ lý Giọng nói',
    'nav.weekly_digest': 'Bản tin Tuần',
    'nav.admin_area': 'Quản trị',
    'nav.sign_in': 'Đăng nhập bằng Google',
    'nav.sign_out': 'Đăng xuất',
    'nav.language': 'Ngôn ngữ',
    'nav.auto_gps': 'Tự động theo GPS',
    'nav.gps_active': 'GPS Bật',
    'nav.gps_detected': 'Đã nhận diện vị trí GPS',

    // Hero / Landing
    'hero.badge': 'Lưu trữ đám mây Cloud Firestore bảo mật & Xác thực Firebase',
    'hero.title_prefix': 'Trò chuyện, Suy ngẫm & Đúc kết Tư duy cùng',
    'hero.title_accent': 'Gemini AI',
    'hero.description': 'Không gian riêng tư, bảo mật cho các buổi đối thoại suy ngẫm nhiều lượt. Biến suy nghĩ thô thành đúc kết sâu sắc, tóm tắt điều hành và kế hoạch hành động với Gemini 3.6 Flash.',
    'hero.cta_google': 'Đăng nhập Google để Bắt đầu',
    'hero.cta_guest': 'Lưu trữ đám mây tức thì & Không lo mất dữ liệu',
    'hero.feature_voice': 'Trợ lý Giọng nói Trực tiếp',
    'hero.feature_voice_desc': 'Đối thoại tự nhiên bằng giọng nói với phản hồi âm thanh theo thời gian thực.',
    'hero.feature_distill': 'Đúc kết Trí tuệ Đa chiều',
    'hero.feature_distill_desc': 'Tổng hợp các nhận thức sâu sắc, tóm tắt ý chính và danh sách hành động thực tế.',
    'hero.feature_maps': 'Ghim Vị trí GPS & Cảm hứng',
    'hero.feature_maps_desc': 'Ghim địa điểm an yên của bạn hoặc khám phá không gian cảm hứng cùng Google Maps.',

    // Reflection Modes
    'mode.deep_reflection': 'Suy ngẫm Sâu sắc',
    'mode.deep_reflection_desc': 'Thấu cảm cảm xúc cốt lõi và khơi mở cơ hội phát triển bản thân.',
    'mode.socratic_coach': 'Huấn luyện viên Socratic',
    'mode.socratic_coach_desc': 'Đặt câu hỏi gợi mở sâu sắc nhằm xem xét lại các giả định ngầm định.',
    'mode.brainstorming': 'Động não & Sáng tạo',
    'mode.brainstorming_desc': 'Tư duy đa chiều, ẩn dụ sáng tạo và mở ra các góc nhìn bất ngờ.',
    'mode.action_planning': 'Kế hoạch Hành động',
    'mode.action_planning_desc': 'Chuyển hóa suy ngẫm thành các bước vi mô cụ thể, dễ thực thi ngay.',
    'mode.gratitude_mindfulness': 'Biết ơn & Chánh niệm',
    'mode.gratitude_mindfulness_desc': 'Neo giữ hiện tại, trân trọng khoảnh khắc đẹp và chuyển hóa căng thẳng.',

    // Entry Editor
    'editor.title_placeholder': 'Đặt tên cho buổi suy ngẫm này...',
    'editor.category_label': 'Chủ đề',
    'editor.mood_label': 'Cảm xúc',
    'editor.priority_label': 'Mức độ',
    'editor.pin_location': 'Ghim Vị trí',
    'editor.pinned_at': 'Đã ghim tại',
    'editor.prompt_placeholder': 'Nhập suy nghĩ, câu hỏi hoặc trăn trở của bạn (Nhấn Enter để gửi, Shift+Enter để xuống dòng)...',
    'editor.reflect_btn': 'Suy ngẫm',
    'editor.distill_btn': 'Đúc kết Trí tuệ',
    'editor.distill_update': 'Cập nhật Đúc kết AI',
    'editor.saved_status': 'Đã lưu vào Firestore',
    'editor.saving_status': 'Đang lưu...',
    'editor.error_status': 'Lỗi lưu trữ',
    'editor.empty_state_title': 'Bắt đầu cuộc trò chuyện suy ngẫm của bạn',
    'editor.empty_state_desc': 'Nhập suy nghĩ vào khung bên dưới hoặc bắt đầu với một trong các câu hỏi gợi mở này:',
    'editor.suggested_1': 'Điều gì đang chiếm nhiều năng lượng tinh thần nhất của tôi lúc này, và tại sao?',
    'editor.suggested_2': 'Có giả định ngầm định nào tôi đang mang trong quyết định hiện tại không?',
    'editor.suggested_3': 'Chiến thắng nhỏ hoặc khoảnh khắc đẹp nào hôm nay mà tôi suýt bỏ lỡ?',
    'editor.listen_aloud': 'Nghe đọc bằng Giọng nói Gemini',
    'editor.dictation_start': 'Bắt đầu Đọc bằng Giọng nói',
    'editor.dictation_stop': 'Dừng Đọc',
    'editor.listening_now': 'Đang lắng nghe giọng nói của bạn...',
    'editor.export_btn': 'Xuất dữ liệu',
    'editor.delete_btn': 'Xóa bài suy ngẫm',
    'editor.delete_confirm': 'Bạn có chắc chắn muốn xóa bài suy ngẫm này không? Thao tác này không thể hoàn tác.',

    // Insights Panel
    'insights.title': 'Đúc kết Trí tuệ & Nhận thức Sâu sắc',
    'insights.summary': 'Tóm tắt Điều hành',
    'insights.key_insights': 'Nhận thức Cốt lõi & Chuyển biến Tư duy',
    'insights.action_items': 'Hành động Khuyến nghị Tiếp theo',
    'insights.detected_mood': 'Sắc thái Cảm xúc Nhận diện',
    'insights.model_used': 'Tổng hợp bởi',

    // History Sidebar
    'sidebar.title': 'Lịch sử Nhật ký',
    'sidebar.search_placeholder': 'Tìm kiếm bài viết, đúc kết, địa điểm...',
    'sidebar.all_categories': 'Tất cả Chủ đề',
    'sidebar.new_btn': 'Tạo mới',
    'sidebar.export_all': 'Xuất tất cả',
    'sidebar.no_entries': 'Chưa tìm thấy bài suy ngẫm nào',
    'sidebar.turns_count': 'lượt trò chuyện',
    'sidebar.delete_confirm': 'Xóa bài suy ngẫm này?',

    // Voice Agent Modal
    'voice.modal_title': 'Trợ lý Đối thoại Giọng nói Trực tiếp',
    'voice.status_idle': 'Chạm vào Khối Cầu để bắt đầu nói',
    'voice.status_listening': 'Đang lắng nghe... Hãy chia sẻ tự nhiên',
    'voice.status_thinking': 'Gemini đang suy ngẫm...',
    'voice.status_speaking': 'Gemini đang nói...',
    'voice.done_speaking': 'Đã nói xong',
    'voice.start_speaking': 'Bắt đầu Nói',
    'voice.interrupt': 'Chạm Khối Cầu để Ngắt lời',
    'voice.transcript_title': 'Bản ghi Lời nói Trực tiếp',
    'voice.switch_mode': 'Đổi Chế độ Suy ngẫm',
    'voice.close': 'Đóng Trợ lý Giọng nói',

    // Weekly Digest Modal
    'digest.modal_title': 'Bản tin Suy ngẫm Tuần & Vòng lặp Phát triển',
    'digest.subtitle': 'Tổng hợp đúc kết tuần, theo dõi mục tiêu cam kết và gửi đến các kênh của bạn.',
    'digest.tab_preview': 'Xem trước Bản tin',
    'digest.tab_channels': 'Kênh Gửi thông báo',
    'digest.tab_apps_script': 'Google Apps Script (Gmail)',
    'digest.btn_generate': 'Tạo & Gửi Bản tin Tuần',
    'digest.btn_save_prefs': 'Lưu Cấu hình Kênh',
    'digest.core_theme': 'Chủ đề Cốt lõi Trong Tuần',
    'digest.executive_summary': 'Tóm tắt Điều hành Tuần',
    'digest.breakthroughs': 'Đột phá & Nhận thức Trọng yếu',
    'digest.goal_followups': 'Theo dõi Tiến độ Mục tiêu',
    'digest.next_week_question': '🌱 Câu hỏi Gợi mở cho Tuần Mới',
    'digest.dispatched_success': 'Bản tin tuần đã được tạo và gửi thành công!',

    // Location Picker Modal
    'location.modal_title': 'Ghim Địa điểm & Không gian Cảm hứng',
    'location.tab_search': 'Tìm Địa điểm',
    'location.tab_gps': 'GPS Hiện tại',
    'location.tab_sanctuaries': 'Địa điểm Gợi ý',
    'location.tab_custom': 'Địa điểm Tự tạo',
    'location.search_placeholder': 'Tìm địa chỉ, quán cà phê, thư viện, công viên, thành phố...',
    'location.gps_button': 'Nhận diện Tọa độ GPS Hiện tại của Tôi',
    'location.gps_auto_language': 'Tự động nhận diện ngôn ngữ theo quốc gia GPS (Việt Nam, Trung Quốc, Hàn Quốc,...)',
    'location.remove_pin': 'Gỡ ghim Vị trí',
    'location.attach_btn': 'Đính kèm Vị trí',
    'location.gps_presets_title': 'Địa điểm Mẫu GPS Nhanh (Kiểm tra Chuyển Đổi Ngôn ngữ)',

    // Export Modal
    'export.modal_title': 'Xuất Lưu trữ Nhật ký',
    'export.scope_current': 'Bài suy ngẫm hiện tại',
    'export.scope_all': 'Tất cả bài suy ngẫm',
    'export.format_md': 'Markdown (.md)',
    'export.format_json': 'JSON (.json)',
    'export.copy_btn': 'Sao chép vào Bộ nhớ tạm',
    'export.download_btn': 'Tải xuống Tệp tin',
    'export.copied': 'Đã sao chép!',

    // Notifications & Toasts
    'toast.language_changed': 'Đã chuyển đổi ngôn ngữ sang',
    'toast.gps_detected': 'GPS nhận diện vị trí tại',
    'toast.gps_error': 'Không thể truy cập GPS. Vui lòng cấp quyền vị trí trình duyệt.',
  },

  zh: {
    // Nav & Brand
    'app.name': 'Gemini 反思日记',
    'app.subtitle': 'AI 心灵反思伴侣',
    'nav.entries': '篇日记',
    'nav.new_entry': '新建反思',
    'nav.history': '历史记录',
    'nav.voice_agent': '语音伴侣',
    'nav.weekly_digest': '每周简报',
    'nav.admin_area': '管理面板',
    'nav.sign_in': '使用 Google 登录',
    'nav.sign_out': '退出登录',
    'nav.language': '语言',
    'nav.auto_gps': '根据 GPS 自动切换',
    'nav.gps_active': 'GPS 已激活',
    'nav.gps_detected': '已识别 GPS 位置',

    // Hero / Landing
    'hero.badge': '用户隔离 Cloud Firestore 持久化与 Firebase 认证',
    'hero.title_prefix': '与 AI 深度对话、反思并沉淀心流：',
    'hero.title_accent': 'Gemini AI',
    'hero.description': '专为多轮深度反思对话打造的私密圣所。借助 Gemini 3.6 Flash 将零散思绪升华为结构化洞察、执行摘要与行动指南。',
    'hero.cta_google': '使用 Google 登录开启反思',
    'hero.cta_guest': '即时云端持久化 · 零本地数据丢失',
    'hero.feature_voice': '实时拟真语音伴侣',
    'hero.feature_voice_desc': '自然流畅的实时语音交互，伴随沉浸式音频播放。',
    'hero.feature_distill': '多维 AI 洞见提炼',
    'hero.feature_distill_desc': '智能总结心路历程，萃取顿悟与可执行行动清单。',
    'hero.feature_maps': 'GPS 地理标记与氛围感知',
    'hero.feature_maps_desc': '借助 Google Maps 定位心流圣所，记录灵感坐标。',

    // Reflection Modes
    'mode.deep_reflection': '深度反思',
    'mode.deep_reflection_desc': '深入共情内在情绪潜台词，挖掘个人成长机遇。',
    'mode.socratic_coach': '苏格拉底导师',
    'mode.socratic_coach_desc': '提出深刻启发式提问，审视深层假设与认知偏见。',
    'mode.brainstorming': '头脑风暴与创新',
    'mode.brainstorming_desc': '横向思考、发散创意隐喻并探索意想不到的视角。',
    'mode.action_planning': '行动规划与落地',
    'mode.action_planning_desc': '将反思沉淀转化为清晰、精炼、易落地的微习惯步骤。',
    'mode.gratitude_mindfulness': '感恩与正念',
    'mode.gratitude_mindfulness_desc': '安住当下，感知微小美好，以自我慈悲化解焦虑。',

    // Entry Editor
    'editor.title_placeholder': '为本次反思对话命名...',
    'editor.category_label': '分类',
    'editor.mood_label': '心境',
    'editor.priority_label': '优先级',
    'editor.pin_location': '固定位置',
    'editor.pinned_at': '固定于',
    'editor.prompt_placeholder': '输入您的思绪、困惑或抉择（Enter 发送，Shift+Enter 换行）...',
    'editor.reflect_btn': '反思',
    'editor.distill_btn': '提炼洞见',
    'editor.distill_update': '更新 AI 洞见',
    'editor.saved_status': '已存入 Firestore',
    'editor.saving_status': '正在保存...',
    'editor.error_status': '保存失败',
    'editor.empty_state_title': '开启您的专属反思之旅',
    'editor.empty_state_desc': '在下方输入任何思绪，或点击以下启发性提问开启对话：',
    'editor.suggested_1': '此时此刻最消耗我心理能量的事情是什么？为什么？',
    'editor.suggested_2': '在当前这项抉择中，我潜意识里做出了什么未经验证的假设？',
    'editor.suggested_3': '今天有什么被我忽略的小胜利或温馨瞬间值得被感恩？',
    'editor.listen_aloud': '朗读 Gemini 回复',
    'editor.dictation_start': '开启语音听写',
    'editor.dictation_stop': '停止听写',
    'editor.listening_now': '正在聆听您的心声...',
    'editor.export_btn': '导出',
    'editor.delete_btn': '删除反思',
    'editor.delete_confirm': '确定要删除此反思记录吗？此操作无法撤销。',

    // Insights Panel
    'insights.title': '沉淀洞察与智慧结晶',
    'insights.summary': '执行摘要',
    'insights.key_insights': '核心顿悟与思维跃迁',
    'insights.action_items': '建议行动计划',
    'insights.detected_mood': '识别的情绪基调',
    'insights.model_used': '生成模型',

    // History Sidebar
    'sidebar.title': '反思历史',
    'sidebar.search_placeholder': '搜索反思、洞察、地点...',
    'sidebar.all_categories': '全部分类',
    'sidebar.new_btn': '新建',
    'sidebar.export_all': '全部导出',
    'sidebar.no_entries': '未找到反思记录',
    'sidebar.turns_count': '轮对话',
    'sidebar.delete_confirm': '确定删除此记录？',

    // Voice Agent Modal
    'voice.modal_title': '实时对话式语音伴侣',
    'voice.status_idle': '轻触灵动光球开启实时对话',
    'voice.status_listening': '正在聆听... 请随心倾诉',
    'voice.status_thinking': 'Gemini 正在沉思...',
    'voice.status_speaking': 'Gemini 正在回答...',
    'voice.done_speaking': '我说完了',
    'voice.start_speaking': '开始讲话',
    'voice.interrupt': '轻触光球打断',
    'voice.transcript_title': '实时对话文字记录',
    'voice.switch_mode': '切换反思模式',
    'voice.close': '关闭语音伴侣',

    // Weekly Digest Modal
    'digest.modal_title': '每周 AI 深度复盘与成长闭环',
    'digest.subtitle': '梳理本周认知成长，跟进承诺目标，并同步推送至您的通知渠道。',
    'digest.tab_preview': '简报预览',
    'digest.tab_channels': '推送渠道',
    'digest.tab_apps_script': 'Google Apps Script (Gmail)',
    'digest.btn_generate': '生成并推送每周复盘简报',
    'digest.btn_save_prefs': '保存渠道偏好',
    'digest.core_theme': '本周核心主题',
    'digest.executive_summary': '每周执行摘要',
    'digest.breakthroughs': '重大突破与心智顿悟',
    'digest.goal_followups': '目标与承诺跟进',
    'digest.next_week_question': '🌱 下周前瞻启发性提问',
    'digest.dispatched_success': '每周简报已成功生成并分发！',

    // Location Picker Modal
    'location.modal_title': '位置标记与心流圣所',
    'location.tab_search': '搜索地点',
    'location.tab_gps': '当前 GPS',
    'location.tab_sanctuaries': '灵感圣所预设',
    'location.tab_custom': '自定义地点',
    'location.search_placeholder': '搜索地址、咖啡馆、图书馆、公园、城市...',
    'location.gps_button': '获取我的实时 GPS 定位',
    'location.gps_auto_language': '根据 GPS 所在国家（中国、越南、韩国等）自动匹配系统语言',
    'location.remove_pin': '移除位置标记',
    'location.attach_btn': '附加上此位置',
    'location.gps_presets_title': '快速 GPS 模拟预设（即时测试语言切换）',

    // Export Modal
    'export.modal_title': '导出反思档案',
    'export.scope_current': '当前反思',
    'export.scope_all': '全部反思',
    'export.format_md': 'Markdown (.md)',
    'export.format_json': 'JSON (.json)',
    'export.copy_btn': '复制到剪贴板',
    'export.download_btn': '下载文件',
    'export.copied': '已复制！',

    // Notifications & Toasts
    'toast.language_changed': '界面语言已切换为',
    'toast.gps_detected': 'GPS 已定位至',
    'toast.gps_error': '无法获取 GPS 位置，请检查浏览器定位权限。',
  },

  ko: {
    // Nav & Brand
    'app.name': 'Gemini 리플렉션',
    'app.subtitle': 'AI 성찰 & 저널링 파트너',
    'nav.entries': '개 성찰 기록',
    'nav.new_entry': '새 성찰',
    'nav.history': '기록 히스토리',
    'nav.voice_agent': '음성 에이전트',
    'nav.weekly_digest': '주간 다이제스트',
    'nav.admin_area': '관리자 콘솔',
    'nav.sign_in': 'Google 계정으로 로그인',
    'nav.sign_out': '로그아웃',
    'nav.language': '언어',
    'nav.auto_gps': 'GPS 자동 감지',
    'nav.gps_active': 'GPS 활성',
    'nav.gps_detected': 'GPS 위치 감지됨',

    // Hero / Landing
    'hero.badge': '사용자 격리 Cloud Firestore 영구 저장 및 Firebase 인증',
    'hero.title_prefix': '깊이 있는 대화와 성찰, 통찰의 정제:',
    'hero.title_accent': 'Gemini AI',
    'hero.description': '다회차 성찰 대화를 위한 안전하고 프라이빗한 저널링 안식처입니다. Gemini 3.6 Flash를 통해 가공되지 않은 생각을 체계적인 통찰, 요약 및 실행 계획으로 전환하세요.',
    'hero.cta_google': 'Google 로그인으로 시작하기',
    'hero.cta_guest': '실시간 클라우드 저장 · 데이터 유실 없는 영구 보관',
    'hero.feature_voice': '실시간 대화형 음성 에이전트',
    'hero.feature_voice_desc': '실시간 오디오 재생과 함께 자연스러운 음성 대화 지원.',
    'hero.feature_distill': '다차원 AI 통찰 정제',
    'hero.feature_distill_desc': '핵심 깨달음, 요약 및 실천 가능한 체크리스트 자동 합성.',
    'hero.feature_maps': 'GPS 위치 핀 & 무드 기록',
    'hero.feature_maps_desc': 'Google Maps를 통해 나만의 사색 공간과 영감의 좌표를 기록하세요.',

    // Reflection Modes
    'mode.deep_reflection': '심층 성찰',
    'mode.deep_reflection_desc': '감정의 본질적 맥락을 공감하고 개인적 성장의 기회를 조명합니다.',
    'mode.socratic_coach': '소크라테스 코치',
    'mode.socratic_coach_desc': '숨겨진 전제와 인지적 편향을 점검하는 명료한 질문을 제시합니다.',
    'mode.brainstorming': '창의적 브레인스토밍',
    'mode.brainstorming_desc': '다각도의 관점, 창의적 은유 및 새로운 가능성을 모색합니다.',
    'mode.action_planning': '실행 계획 수립',
    'mode.action_planning_desc': '생각을 작고 즉각 실천 가능한 마이크로 액션 스텝으로 구체화합니다.',
    'mode.gratitude_mindfulness': '감사와 마음챙김',
    'mode.gratitude_mindfulness_desc': '현재에 머무르며 소소한 성취를 음미하고 긴장을 완화합니다.',

    // Entry Editor
    'editor.title_placeholder': '이번 성찰 세션의 제목을 입력하세요...',
    'editor.category_label': '카테고리',
    'editor.mood_label': '기분/심경',
    'editor.priority_label': '우선순위',
    'editor.pin_location': '위치 고정',
    'editor.pinned_at': '고정된 위치:',
    'editor.prompt_placeholder': '생각, 질문 또는 고민을 입력하세요 (Enter: 전송, Shift+Enter: 줄바꿈)...',
    'editor.reflect_btn': '성찰하기',
    'editor.distill_btn': '통찰 정제하기',
    'editor.distill_update': 'AI 통찰 업데이트',
    'editor.saved_status': 'Firestore 저장 완료',
    'editor.saving_status': '저장 중...',
    'editor.error_status': '저장 오류',
    'editor.empty_state_title': '나만의 성찰 대화를 시작하세요',
    'editor.empty_state_desc': '아래 입력창에 생각을 적거나, 다음 질문 중 하나를 선택해 보세요:',
    'editor.suggested_1': '지금 나의 정신적 에너지를 가장 많이 소모시키는 것은 무엇이며, 왜 그런가요?',
    'editor.suggested_2': '현재 내리고 있는 결정에서 내가 무의식중에 전제하고 있는 가정은 무엇인가요?',
    'editor.suggested_3': '오늘 거의 지나칠 뻔했던 소소한 승리나 아름다운 순간은 무엇이었나요?',
    'editor.listen_aloud': 'Gemini 음성으로 듣기',
    'editor.dictation_start': '음성 받아쓰기 시작',
    'editor.dictation_stop': '받아쓰기 중지',
    'editor.listening_now': '음성을 듣고 있습니다...',
    'editor.export_btn': '내보내기',
    'editor.delete_btn': '성찰 기록 삭제',
    'editor.delete_confirm': '정말로 이 성찰 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.',

    // Insights Panel
    'insights.title': '정제된 통찰 및 핵심 깨달음',
    'insights.summary': '핵심 요약',
    'insights.key_insights': '주요 깨달음 & 사고의 전환',
    'insights.action_items': '권장 실천 과제',
    'insights.detected_mood': '감지된 감정 톤',
    'insights.model_used': '합성 모델',

    // History Sidebar
    'sidebar.title': '저널 히스토리',
    'sidebar.search_placeholder': '성찰 내용, 통찰, 장소 검색...',
    'sidebar.all_categories': '전체 카테고리',
    'sidebar.new_btn': '새로 만들기',
    'sidebar.export_all': '전체 내보내기',
    'sidebar.no_entries': '저장된 성찰 기록이 없습니다',
    'sidebar.turns_count': '개 대화',
    'sidebar.delete_confirm': '이 성찰 기록을 삭제하시겠습니까?',

    // Voice Agent Modal
    'voice.modal_title': '실시간 대화형 음성 파트너',
    'voice.status_idle': '보이스 오브를 탭하여 대화를 시작하세요',
    'voice.status_listening': '듣고 있습니다... 편안하게 말씀해 주세요',
    'voice.status_thinking': 'Gemini가 생각하는 중입니다...',
    'voice.status_speaking': 'Gemini가 답변하는 중입니다...',
    'voice.done_speaking': '말씀 완료',
    'voice.start_speaking': '말하기 시작',
    'voice.interrupt': '오브를 탭하여 끊기',
    'voice.transcript_title': '실시간 음성 대화 스크립트',
    'voice.switch_mode': '성찰 모드 변경',
    'voice.close': '음성 에이전트 닫기',

    // Weekly Digest Modal
    'digest.modal_title': '주간 AI 성찰 다이제스트 & 성장 루프',
    'digest.subtitle': '한 주간의 생각과 다짐을 종합하고 지정한 채널로 전송합니다.',
    'digest.tab_preview': '다이제스트 미리보기',
    'digest.tab_channels': '전송 채널',
    'digest.tab_apps_script': 'Google Apps Script (Gmail)',
    'digest.btn_generate': '주간 다이제스트 생성 및 전송',
    'digest.btn_save_prefs': '채널 환경설정 저장',
    'digest.core_theme': '이번 주 핵심 테마',
    'digest.executive_summary': '주간 핵심 요약',
    'digest.breakthroughs': '주요 돌파구 & 깨달음',
    'digest.goal_followups': '목표 & 약속 점검',
    'digest.next_week_question': '🌱 다음 주를 위한 성찰 질문',
    'digest.dispatched_success': '주간 다이제스트가 성공적으로 생성 및 발송되었습니다!',

    // Location Picker Modal
    'location.modal_title': '위치 고정 & 영감의 안식처',
    'location.tab_search': '장소 검색',
    'location.tab_gps': '현재 GPS',
    'location.tab_sanctuaries': '추천 안식처 프리셋',
    'location.tab_custom': '직접 입력',
    'location.search_placeholder': '주소, 카페, 도서관, 공원, 도시 검색...',
    'location.gps_button': '현재 내 GPS 위치 감지하기',
    'location.gps_auto_language': 'GPS 국가(베트남, 중국, 한국 등)에 맞춰 앱 언어를 자동으로 전환합니다',
    'location.remove_pin': '위치 핀 해제',
    'location.attach_btn': '위치 첨부',
    'location.gps_presets_title': '빠른 GPS 시뮬레이션 프리셋 (언어 전환 즉시 테스트)',

    // Export Modal
    'export.modal_title': '성찰 아카이브 내보내기',
    'export.scope_current': '현재 성찰 기록',
    'export.scope_all': '전체 성찰 기록',
    'export.format_md': 'Markdown (.md)',
    'export.format_json': 'JSON (.json)',
    'export.copy_btn': '클립보드에 복사',
    'export.download_btn': '파일 다운로드',
    'export.copied': '복사 완료!',

    // Notifications & Toasts
    'toast.language_changed': '언어가 다음으로 변경되었습니다:',
    'toast.gps_detected': 'GPS 위치가 감지되었습니다:',
    'toast.gps_error': 'GPS 위치를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.',
  }
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  isAutoGpsEnabled: boolean;
  setIsAutoGpsEnabled: (enabled: boolean) => void;
  detectAndApplyGpsLanguage: (overrideLat?: number, overrideLng?: number) => Promise<{ language: SupportedLanguage; regionName: string } | null>;
  t: (key: string, defaultText?: string) => string;
  tObj: <T>(map: Partial<Record<SupportedLanguage, T>> & { en: T }) => T;
  lastDetectedRegion: string | null;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  isAutoGpsEnabled: false,
  setIsAutoGpsEnabled: () => {},
  detectAndApplyGpsLanguage: async (overrideLat?: number, overrideLng?: number) => null,
  t: (key, defaultText) => defaultText || key,
  tObj: (map) => map.en,
  lastDetectedRegion: null,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const savedLang = localStorage.getItem('gemini_journal_lang') as SupportedLanguage;
      if (savedLang && ['en', 'vi', 'zh', 'ko'].includes(savedLang)) {
        return savedLang;
      }
      const browserLang = navigator.language ? navigator.language.toLowerCase() : '';
      if (browserLang.startsWith('vi')) return 'vi';
      if (browserLang.startsWith('zh')) return 'zh';
      if (browserLang.startsWith('ko')) return 'ko';
    } catch {}
    return 'en';
  });

  const [isAutoGpsEnabled, setIsAutoGpsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('gemini_journal_auto_gps') === 'true';
    } catch {
      return false;
    }
  });

  const [lastDetectedRegion, setLastDetectedRegion] = useState<string | null>(null);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('gemini_journal_lang', lang);
    } catch {}
  }, []);

  const setIsAutoGpsEnabled = useCallback((enabled: boolean) => {
    setIsAutoGpsEnabledState(enabled);
    try {
      localStorage.setItem('gemini_journal_auto_gps', enabled ? 'true' : 'false');
    } catch {}
  }, []);

  const detectAndApplyGpsLanguage = useCallback(async (overrideLat?: number, overrideLng?: number): Promise<{ language: SupportedLanguage; regionName: string } | null> => {
    if (typeof overrideLat === 'number' && typeof overrideLng === 'number') {
      const { language: detectedLang, regionName } = detectLanguageFromCoordinates(overrideLat, overrideLng);
      setLanguage(detectedLang);
      setLastDetectedRegion(regionName);
      setIsAutoGpsEnabled(true);
      return { language: detectedLang, regionName };
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const { language: detectedLang, regionName } = detectLanguageFromCoordinates(latitude, longitude);
          setLanguage(detectedLang);
          setLastDetectedRegion(regionName);
          setIsAutoGpsEnabled(true);
          resolve({ language: detectedLang, regionName });
        },
        (err) => {
          console.warn('Geolocation access failed or denied:', err);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }, [setLanguage, setIsAutoGpsEnabled]);

  const t = useCallback((key: string, defaultText?: string): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    if (dict[key]) return dict[key];
    const fallbackDict = TRANSLATIONS.en;
    if (fallbackDict[key]) return fallbackDict[key];
    return defaultText || key;
  }, [language]);

  const tObj = useCallback(<T,>(map: Partial<Record<SupportedLanguage, T>> & { en: T }): T => {
    return (map[language] as T) || map.en;
  }, [language]);

  return React.createElement(
    LanguageContext.Provider,
    {
      value: {
        language,
        setLanguage,
        isAutoGpsEnabled,
        setIsAutoGpsEnabled,
        detectAndApplyGpsLanguage,
        t,
        tObj,
        lastDetectedRegion,
      },
    },
    children
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
