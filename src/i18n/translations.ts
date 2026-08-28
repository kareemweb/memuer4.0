export type Language = 'en' | 'ar';

export type TranslationKey =
  | 'welcomeHome'
  | 'welcomeSubtitle'
  | 'findContacts'
  | 'connectById'
  | 'messages'
  | 'contacts'
  | 'requests'
  | 'searchPlaceholder'
  | 'search'
  | 'newAIChat'
  | 'aiAssistant'
  | 'encryptedChat'
  | 'online'
  | 'typeMessage'
  | 'securityCode'
  | 'profile'
  | 'displayName'
  | 'email'
  | 'password'
  | 'save'
  | 'cancel'
  | 'logout'
  | 'loginTitle'
  | 'loginSub'
  | 'enterVault'
  | 'createAccount'
  | 'feed'
  | 'reels'
  | 'createPost'
  | 'sharePost'
  | 'comments'
  | 'likes'
  | 'language'
  | 'english'
  | 'arabic'
  | 'noPostsYet'
  | 'shareFirstPhoto'
  | 'backToChats'
  | 'addConnection'
  | 'enterUserId'
  | 'add'
  | 'settings'
  | 'saveChanges'
  | 'ok'
  | 'continueBtn';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    welcomeHome: 'Welcome Home',
    welcomeSubtitle: 'Your private chat space is secure and ready.',
    findContacts: 'Contacts',
    connectById: 'Add Contact',
    messages: 'Messages',
    contacts: 'Contacts',
    requests: 'Requests',
    searchPlaceholder: 'Search messages or contacts...',
    search: 'Search...',
    newAIChat: 'New AI Assistant Chat',
    aiAssistant: 'AI Assistant',
    encryptedChat: 'End-to-End Encrypted',
    online: 'Online',
    typeMessage: 'Type a message...',
    securityCode: 'Security ID',
    profile: 'Profile Settings',
    displayName: 'Display Name',
    email: 'Email Address',
    password: 'Password',
    save: 'Save Changes',
    cancel: 'Cancel',
    logout: 'Log Out',
    loginTitle: 'Welcome to Memuer',
    loginSub: 'Simple, Beautiful & Private Messaging',
    enterVault: 'Sign In to Chat',
    createAccount: 'Create New Account',
    feed: 'Feed',
    reels: 'Reels',
    createPost: 'Create Post',
    sharePost: 'Share Post',
    comments: 'Comments',
    likes: 'Likes',
    language: 'Language',
    english: 'English',
    arabic: 'العربية (Arabic)',
    noPostsYet: 'No Posts Yet',
    shareFirstPhoto: 'Be the first to share a moment on Memuer Social+!',
    backToChats: 'Back to Messages',
    addConnection: 'Add New Contact',
    enterUserId: 'Enter user ID or email',
    add: 'Add',
    settings: 'Settings',
    saveChanges: 'Save Changes',
    ok: 'OK',
    continueBtn: 'Continue'
  },
  ar: {
    welcomeHome: 'أهلاً بك في بيتك',
    welcomeSubtitle: 'مساحتك الخاصة آمنة وجاهزة للمحادثات.',
    findContacts: 'جهات الاتصال',
    connectById: 'إضافة جهة اتصال',
    messages: 'المحادثات',
    contacts: 'جهات الاتصال',
    requests: 'الطلبات',
    searchPlaceholder: 'البحث في المحادثات أو الأسماء...',
    search: 'بحث...',
    newAIChat: 'محادثة مع المساعد الذكي',
    aiAssistant: 'المساعد الذكي',
    encryptedChat: 'محادثة مشفرة بالكامل',
    online: 'متصل الآن',
    typeMessage: 'اكتب رسالتك هنا...',
    securityCode: 'معرّف الأمان',
    profile: 'الملف الشخصي',
    displayName: 'الاسم الظاهر',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    save: 'حفظ التغييرات',
    cancel: 'إلغاء',
    logout: 'تسجيل الخروج',
    loginTitle: 'مرحباً بك في ميميوير',
    loginSub: 'تطبيق مراسلة بسيط، جميل، وآمن للجميع',
    enterVault: 'تسجيل الدخول للمحادثات',
    createAccount: 'إنشاء حساب جديد',
    feed: 'الرئيسية',
    reels: 'مقاطع قصيرة',
    createPost: 'إنشاء منشور',
    sharePost: 'نشر المنشور',
    comments: 'التعليقات',
    likes: 'الإعجابات',
    language: 'اللغة',
    english: 'English',
    arabic: 'العربية',
    noPostsYet: 'لا توجد منشورات بعد',
    shareFirstPhoto: 'كن أول من يشارك لحظة على Memuer Social+!',
    backToChats: 'العودة للمحادثات',
    addConnection: 'إضافة جهة اتصال جديدة',
    enterUserId: 'أدخل المعرف أو البريد الإلكتروني',
    add: 'إضافة',
    settings: 'الإعدادات',
    saveChanges: 'حفظ التغييرات',
    ok: 'موافق',
    continueBtn: 'متابعة'
  }
};
