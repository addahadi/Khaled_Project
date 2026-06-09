export const dictionary: Record<string, Record<string, string>> = {
  en: {
    // Network / Generic
    ERROR_NETWORK_FAILURE:          'Unable to connect to the server. Please try again.',
    ERROR_DEFAULT:                  'An unexpected error occurred.',
    ERROR_VALIDATION_FAILED:        'Please correct the highlighted fields.',
    ERROR_UNAUTHORIZED:             'You are not authorized. Please log in.',
    ERROR_FORBIDDEN:                'You do not have permission to perform this action.',
    ERROR_ROUTE_NOT_FOUND:          'The requested resource was not found.',
    ERROR_TOKEN_INVALID:            'Session is invalid. Please log in again.',
    ERROR_TOKEN_EXPIRED:            'Session has expired. Please log in again.',
    ERROR_TOKEN_REVOKED:            'Session was revoked. Please log in again.',
    ERROR_TOKEN_REUSE_DETECTED:     'Security alert: session reuse detected. Please log in again.',

    // Auth field errors
    ERR_USERNAME_TOO_SHORT:         'Username must be at least 3 characters.',
    ERR_EMAIL_INVALID:              'Please enter a valid email address.',
    ERR_PASSWORD_TOO_SHORT:         'Password must be at least 8 characters.',
    ERR_PASSWORD_REQUIRED:          'Password is required.',
    ERR_ROLE_INVALID:               'Please select a valid role.',
    ERR_ORG_INVALID:                'Invalid organization selected.',
    ERR_DEPT_INVALID:               'Invalid department selected.',

    // Auth messages
    ERROR_ACCOUNT_EXISTS:           'An account with this email or username already exists.',
    ERROR_INVALID_CREDENTIALS:      'Incorrect email or password.',
    ERROR_ACCOUNT_LOCKED:           'Account locked due to too many failed attempts. Try again in 15 minutes.',
    ERROR_ACCOUNT_INCOMPLETE:       'Account setup is incomplete. Please contact support.',
    SUCCESS_REGISTERED:             'Account created successfully! Please log in.',
    SUCCESS_LOGIN:                  'Welcome back!',
    SUCCESS_LOGOUT:                 'You have been logged out.',

    // Patients
    ERR_NAME_TOO_SHORT:             'Name must be at least 2 characters.',
    ERR_AGE_INVALID:                'Age must be between 0 and 150.',
    ERR_GENDER_INVALID:             'Please select a valid gender.',
    ERROR_PATIENT_NOT_FOUND:        'Patient not found.',
    SUCCESS_PATIENT_CREATED:        'Patient registered successfully.',

    // Clinical data
    SUCCESS_CLINICAL_DATA_SAVED:    'Clinical data saved successfully.',
    SUCCESS_CLINICAL_DATA_UPDATED:  'Clinical data updated successfully.',
    SUCCESS_CLINICAL_DATA_DELETED:  'Clinical record archived successfully.',
    ERROR_CLINICAL_DATA_NOT_FOUND:  'Clinical record not found.',
    ERROR_CLINICAL_DATA_DUPLICATE:  'A record was already submitted for this patient within the last 30 minutes.',
    ERROR_NOTHING_TO_UPDATE:        'No fields provided to update.',

    // Lab orders & results
    ERR_TEST_TYPE_REQUIRED:         'Test type is required.',
    ERR_TEST_INVALID:               'Invalid test order selected.',
    ERR_ANALYTE_REQUIRED:           'Analyte name is required.',
    ERR_VALUE_REQUIRED:             'Result value is required.',
    ERR_FLAG_INVALID:               'Please select a valid result flag.',
    ERR_RESULTS_REQUIRED:           'At least one result is required.',
    ERROR_ORDER_NOT_FOUND:          'Lab order not found.',
    SUCCESS_LAB_ORDER_CREATED:      'Lab order submitted successfully.',
    SUCCESS_ORDER_STARTED:          'Order marked as in-progress.',
    SUCCESS_RESULTS_ENTERED:        'Lab results entered and doctor notified.',

    // Predictions
    ERR_PATIENT_INVALID:            'Invalid patient selected.',
    ERROR_PREDICTION_NOT_FOUND:     'Prediction not found.',
    ERROR_PREDICTION_LIMIT_REACHED: 'Monthly prediction limit reached. Please upgrade your plan.',
    SUCCESS_PREDICTION_REQUESTED:   'Prediction request submitted.',
    SUCCESS_PREDICTION_OVERAGE:     'Prediction submitted. Note: monthly limit exceeded, overage billing applies.',

    // Alerts
    ERROR_ALERT_NOT_FOUND:          'Alert not found.',
    SUCCESS_ALERT_READ:             'Alert marked as read.',

    // Subscriptions / Plans
    ERR_PLAN_INVALID:               'Please select a valid plan.',
    ERROR_PLAN_NOT_FOUND:           'Plan not found.',
    ERROR_NO_ACTIVE_SUBSCRIPTION:   'No active subscription found. Please subscribe to continue.',
    ERROR_NO_ORGANIZATION:          'Your account is not linked to an organization.',
    SUCCESS_SUBSCRIPTION_CREATED:   'Subscription activated successfully.',
    SUCCESS_PLAN_CHANGED:           'Plan updated successfully.',

    // Staff / Org
    ERR_STATUS_INVALID:             'Invalid status value.',
    ERROR_USER_NOT_FOUND:           'User not found.',
    ERROR_ORG_NOT_FOUND:            'Organization not found.',
    SUCCESS_STATUS_UPDATED:         'User status updated.',
    SUCCESS_DEPT_CREATED:           'Department created successfully.',
    ERROR_CANNOT_UPDATE_OWN_STATUS: 'You cannot change your own status.',
    ERROR_LAST_ACTIVE_MANAGER:      'Cannot deactivate the last active manager in the organization.',
    ERROR_TRIAL_NOT_ALLOWED:        'Trial plans are only available during initial registration.',

    // ── Assignments (care team) ──────────────────────────────────────────────
    ERR_DOCTOR_INVALID:                 'Please select a valid doctor.',
    ERROR_ASSIGNMENT_NOT_FOUND:         'Assignment not found.',
    ERROR_ALREADY_ASSIGNED:             'This doctor is already assigned to this patient.',
    ERROR_CANNOT_ASSIGN_SELF:           'You cannot assign yourself. Use "Join Care Team" instead.',
    ERROR_NOT_ASSIGNED_TO_PATIENT:      'You are not assigned to this patient. Join the care team to make changes.',
    ERROR_NOT_PRIMARY_DOCTOR:           'Only the primary doctor can perform this action.',
    ERROR_CANNOT_DISCHARGE_PRIMARY:     'The primary doctor cannot be directly discharged. Transfer ownership first.',
    ERROR_CANNOT_TRANSFER_TO_SELF:      'You cannot transfer primary ownership to yourself.',
    SUCCESS_ASSIGNMENT_CREATED:         'Doctor added to care team successfully.',
    SUCCESS_ASSIGNMENT_DISCHARGED:      'Doctor removed from care team.',
    SUCCESS_PRIMARY_TRANSFERRED:        'Primary ownership transferred successfully.',
    SUCCESS_JOINED_CARE_TEAM:           'You have joined this patient\'s care team as Covering.',

    // Generic successes
    SUCCESS_DEFAULT:                'Operation completed successfully.',
    SUCCESS_SAVED:                  'Changes saved successfully.',
    SUCCESS_DELETED:                'Item deleted successfully.',
  },

  ar: {
    // Network / Generic
    ERROR_NETWORK_FAILURE:          'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
    ERROR_DEFAULT:                  'حدث خطأ غير متوقع.',
    ERROR_VALIDATION_FAILED:        'يرجى تصحيح الحقول المميزة.',
    ERROR_UNAUTHORIZED:             'غير مصرح لك. يرجى تسجيل الدخول.',
    ERROR_FORBIDDEN:                'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
    ERROR_ROUTE_NOT_FOUND:          'المورد المطلوب غير موجود.',
    ERROR_TOKEN_INVALID:            'الجلسة غير صالحة. يرجى تسجيل الدخول مجدداً.',
    ERROR_TOKEN_EXPIRED:            'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.',
    ERROR_TOKEN_REVOKED:            'تم إلغاء الجلسة. يرجى تسجيل الدخول مجدداً.',
    ERROR_TOKEN_REUSE_DETECTED:     'تنبيه أمني: تم اكتشاف إعادة استخدام الجلسة. يرجى تسجيل الدخول.',

    // Auth field errors
    ERR_USERNAME_TOO_SHORT:         'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.',
    ERR_EMAIL_INVALID:              'يرجى إدخال بريد إلكتروني صالح.',
    ERR_PASSWORD_TOO_SHORT:         'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
    ERR_PASSWORD_REQUIRED:          'كلمة المرور مطلوبة.',
    ERR_ROLE_INVALID:               'يرجى اختيار دور صالح.',
    ERR_ORG_INVALID:                'مؤسسة غير صالحة.',
    ERR_DEPT_INVALID:               'قسم غير صالح.',

    // Auth messages
    ERROR_ACCOUNT_EXISTS:           'حساب بهذا البريد الإلكتروني أو اسم المستخدم موجود مسبقاً.',
    ERROR_INVALID_CREDENTIALS:      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    ERROR_ACCOUNT_LOCKED:           'تم قفل الحساب بسبب محاولات تسجيل دخول متعددة فاشلة. حاول مرة أخرى بعد 15 دقيقة.',
    ERROR_ACCOUNT_INCOMPLETE:       'إعداد الحساب غير مكتمل. يرجى التواصل مع الدعم الفني.',
    SUCCESS_REGISTERED:             'تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول.',
    SUCCESS_LOGIN:                  'مرحباً بعودتك!',
    SUCCESS_LOGOUT:                 'تم تسجيل الخروج بنجاح.',

    // Patients
    ERR_NAME_TOO_SHORT:             'يجب أن يتكون الاسم من حرفين على الأقل.',
    ERR_AGE_INVALID:                'يجب أن يكون العمر بين 0 و150.',
    ERR_GENDER_INVALID:             'يرجى اختيار جنس صالح.',
    ERROR_PATIENT_NOT_FOUND:        'المريض غير موجود.',
    SUCCESS_PATIENT_CREATED:        'تم تسجيل المريض بنجاح.',

    // Clinical data
    SUCCESS_CLINICAL_DATA_SAVED:    'تم حفظ البيانات السريرية بنجاح.',
    SUCCESS_CLINICAL_DATA_UPDATED:  'تم تحديث البيانات السريرية بنجاح.',
    SUCCESS_CLINICAL_DATA_DELETED:  'تم أرشفة السجل السريري بنجاح.',
    ERROR_CLINICAL_DATA_NOT_FOUND:  'السجل السريري غير موجود.',
    ERROR_CLINICAL_DATA_DUPLICATE:  'تم إدخال سجل لهذا المريض خلال الـ 30 دقيقة الماضية.',
    ERROR_NOTHING_TO_UPDATE:        'لم يتم تقديم أي حقول للتحديث.',

    // Lab orders & results
    ERR_TEST_TYPE_REQUIRED:         'نوع الفحص مطلوب.',
    ERR_TEST_INVALID:               'طلب فحص غير صالح.',
    ERR_ANALYTE_REQUIRED:           'اسم العنصر مطلوب.',
    ERR_VALUE_REQUIRED:             'قيمة النتيجة مطلوبة.',
    ERR_FLAG_INVALID:               'يرجى اختيار مؤشر نتيجة صالح.',
    ERR_RESULTS_REQUIRED:           'يجب إدخال نتيجة واحدة على الأقل.',
    ERROR_ORDER_NOT_FOUND:          'طلب المختبر غير موجود.',
    SUCCESS_LAB_ORDER_CREATED:      'تم إرسال طلب المختبر بنجاح.',
    SUCCESS_ORDER_STARTED:          'تم تمييز الطلب كقيد التنفيذ.',
    SUCCESS_RESULTS_ENTERED:        'تم إدخال نتائج المختبر وإشعار الطبيب.',

    // Predictions
    ERR_PATIENT_INVALID:            'مريض غير صالح.',
    ERROR_PREDICTION_NOT_FOUND:     'التنبؤ غير موجود.',
    ERROR_PREDICTION_LIMIT_REACHED: 'تم الوصول إلى الحد الشهري للتنبؤات. يرجى ترقية خطتك.',
    SUCCESS_PREDICTION_REQUESTED:   'تم إرسال طلب التنبؤ.',
    SUCCESS_PREDICTION_OVERAGE:     'تم إرسال التنبؤ. تنبيه: تم تجاوز الحد الشهري وتطبق رسوم إضافية.',

    // Alerts
    ERROR_ALERT_NOT_FOUND:          'التنبيه غير موجود.',
    SUCCESS_ALERT_READ:             'تم تمييز التنبيه كمقروء.',

    // Subscriptions / Plans
    ERR_PLAN_INVALID:               'يرجى اختيار خطة صالحة.',
    ERROR_PLAN_NOT_FOUND:           'الخطة غير موجودة.',
    ERROR_NO_ACTIVE_SUBSCRIPTION:   'لا يوجد اشتراك نشط. يرجى الاشتراك للمتابعة.',
    ERROR_NO_ORGANIZATION:          'حسابك غير مرتبط بمؤسسة.',
    SUCCESS_SUBSCRIPTION_CREATED:   'تم تفعيل الاشتراك بنجاح.',
    SUCCESS_PLAN_CHANGED:           'تم تحديث الخطة بنجاح.',

    // Staff / Org
    ERR_STATUS_INVALID:             'قيمة الحالة غير صالحة.',
    ERROR_USER_NOT_FOUND:           'المستخدم غير موجود.',
    ERROR_ORG_NOT_FOUND:            'المؤسسة غير موجودة.',
    SUCCESS_STATUS_UPDATED:         'تم تحديث حالة المستخدم.',
    SUCCESS_DEPT_CREATED:           'تم إنشاء القسم بنجاح.',
    ERROR_CANNOT_UPDATE_OWN_STATUS: 'لا يمكنك تغيير حالتك الخاصة.',
    ERROR_LAST_ACTIVE_MANAGER:      'لا يمكن تعطيل آخر مدير نشط في المؤسسة.',
    ERROR_TRIAL_NOT_ALLOWED:        'خطط التجربة متاحة فقط أثناء التسجيل الأولي.',

    // ── Assignments (care team) ──────────────────────────────────────────────
    ERR_DOCTOR_INVALID:                 'يرجى اختيار طبيب صالح.',
    ERROR_ASSIGNMENT_NOT_FOUND:         'التعيين غير موجود.',
    ERROR_ALREADY_ASSIGNED:             'هذا الطبيب مُعيَّن لهذا المريض بالفعل.',
    ERROR_CANNOT_ASSIGN_SELF:           'لا يمكنك تعيين نفسك. استخدم "الانضمام للفريق الطبي".',
    ERROR_NOT_ASSIGNED_TO_PATIENT:      'أنت غير مُعيَّن لهذا المريض. انضم إلى الفريق الطبي لإجراء التعديلات.',
    ERROR_NOT_PRIMARY_DOCTOR:           'هذا الإجراء متاح للطبيب الرئيسي فقط.',
    ERROR_CANNOT_DISCHARGE_PRIMARY:     'لا يمكن إلغاء تعيين الطبيب الرئيسي مباشرةً. قم بنقل الملكية أولاً.',
    ERROR_CANNOT_TRANSFER_TO_SELF:      'لا يمكنك نقل الملكية الرئيسية لنفسك.',
    SUCCESS_ASSIGNMENT_CREATED:         'تمت إضافة الطبيب إلى الفريق الطبي بنجاح.',
    SUCCESS_ASSIGNMENT_DISCHARGED:      'تم إزالة الطبيب من الفريق الطبي.',
    SUCCESS_PRIMARY_TRANSFERRED:        'تم نقل الملكية الرئيسية بنجاح.',
    SUCCESS_JOINED_CARE_TEAM:           'لقد انضممت إلى الفريق الطبي لهذا المريض بصفة طبيب نيابة.',

    // Generic successes
    SUCCESS_DEFAULT:                'تمت العملية بنجاح.',
    SUCCESS_SAVED:                  'تم حفظ التغييرات بنجاح.',
    SUCCESS_DELETED:                'تم حذف العنصر بنجاح.',
  },
};

export const getCurrentLanguage = (): string =>
  localStorage.getItem('app_lang') || 'en';
