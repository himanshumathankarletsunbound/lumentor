import { db } from '../../db/store';
import { requireServerSecret, isDemoMode } from '../../config/server';

export interface ClasscardApiResponse<T> {
  success: boolean;
  data?: T;
  statusCode: number;
  errorMessage?: string;
  isMock: boolean;
  emptyBody: boolean;
}

export class ClasscardApiClient {
  private baseUrl: string;
  private apiKey: string;
  private useMockMode: boolean = false;

  constructor() {
    const config = db.getClasscardConfig();
    this.baseUrl = (config.baseUrl || 'https://api.classcardapp.com/api/v2/public/').replace(/\/+$/, '');
    this.apiKey = requireServerSecret('CLASSCARD_API_KEY');
    this.useMockMode = isDemoMode;
  }

  /**
   * Internal request handler with retries, timeout, and empty body parsing.
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    retries: number = 2
  ): Promise<ClasscardApiResponse<T>> {
    const config = db.getClasscardConfig();
    const effectiveApiKey = requireServerSecret('CLASSCARD_API_KEY');
    const effectiveBaseUrl = (config.baseUrl || 'https://api.classcardapp.com/api/v2/public/').replace(/\/+$/, '');
    const isMock = isDemoMode && config.useMockMode;

    // If mock mode is enabled or running in test runner without live key, return simulated response
    if (isMock) {
      return this.handleMockRequest<T>(endpoint, method, body);
    }
    if (!effectiveApiKey) {
      return {
        success: false,
        statusCode: 503,
        errorMessage: 'CLASSCARD_API_KEY is not configured on the server.',
        isMock: false,
        emptyBody: true,
      };
    }

    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${effectiveBaseUrl}${cleanPath}`;

    const headers: Record<string, string> = {
      'api-key': effectiveApiKey,
      Accept: 'application/json',
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle endpoints returning empty body safely (documented API quirk)
      const text = await response.text();
      const isEmpty = !text || text.trim().length === 0;

      if (!response.ok) {
        // Retry on 5xx errors or 429 rate limit
        if (retries > 0 && (response.status >= 500 || response.status === 429)) {
          const delay = response.status === 429 ? 2500 : 1000;
          await new Promise((r) => setTimeout(r, delay));
          return this.request<T>(endpoint, method, body, retries - 1);
        }

        return {
          success: false,
          statusCode: response.status,
          errorMessage: `Classcard API Error (${response.status}): ${text || response.statusText}`,
          isMock: false,
          emptyBody: isEmpty,
        };
      }

      let parsedData: T | undefined = undefined;
      if (!isEmpty) {
        try {
          parsedData = JSON.parse(text) as T;
        } catch {
          // Non-JSON successful response
          parsedData = (text as unknown) as T;
        }
      }

      return {
        success: true,
        data: parsedData,
        statusCode: response.status,
        isMock: false,
        emptyBody: isEmpty,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return this.request<T>(endpoint, method, body, retries - 1);
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        statusCode: 0,
        errorMessage: `Network error reaching Classcard API: ${errMsg}`,
        isMock: false,
        emptyBody: true,
      };
    }
  }

  /**
   * High-fidelity mock adapter for development and testing.
   */
  private handleMockRequest<T>(
    endpoint: string,
    method: string,
    body?: unknown
  ): ClasscardApiResponse<T> {
    // Ping / test-connection
    if (endpoint === '/test' || endpoint === '/status' || endpoint.includes('ping')) {
      return {
        success: true,
        data: ({ status: 'CONNECTED', version: '2.4.1', institution: 'LUmentor Production' } as unknown) as T,
        statusCode: 200,
        isMock: true,
        emptyBody: false,
      };
    }

    // Students
    if (endpoint === '/students' && method === 'GET') {
      const students = db.getStudents().map((s) => ({
        id: s.externalId || `cc-stud-${s.id}`,
        first_name: s.firstName,
        last_name: s.lastName,
        email: s.email,
        phone: s.phone,
        status: s.status,
      }));
      return { success: true, data: (students as unknown) as T, statusCode: 200, isMock: true, emptyBody: false };
    }

    if (endpoint === '/students' && method === 'POST') {
      const payload = body as Record<string, unknown>;
      return {
        success: true,
        data: ({
          id: `cc-stud-${Date.now()}`,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          created_at: new Date().toISOString(),
        } as unknown) as T,
        statusCode: 201,
        isMock: true,
        emptyBody: false,
      };
    }

    // Staff
    if (endpoint.includes('/staff') && method === 'GET') {
      const mentors = db.getMentors().map((m) => ({
        id: m.externalId || `cc-staff-${m.id}`,
        name: `${m.firstName} ${m.lastName}`,
        email: m.email,
        phone: m.phone,
        status: m.status,
      }));
      return { success: true, data: (mentors as unknown) as T, statusCode: 200, isMock: true, emptyBody: false };
    }

    // Events
    if (endpoint.includes('/events') && method === 'GET') {
      const events = db.getClasses().map((c) => ({
        id: c.externalId || `cc-evt-${c.id}`,
        title: c.title,
        start_time: c.startTime,
        end_time: c.endTime,
        duration: c.durationMinutes,
        status: c.status,
        mentor_name: c.mentorName,
        branch_name: c.branchName,
      }));
      return { success: true, data: (events as unknown) as T, statusCode: 200, isMock: true, emptyBody: false };
    }

    // Invoices
    if (endpoint.includes('/invoices') && method === 'GET') {
      const invoices = db.getInvoices().map((inv) => ({
        id: inv.externalId || `cc-inv-${inv.id}`,
        invoice_number: inv.invoiceNumber,
        student_name: inv.studentName,
        total: inv.totalAmount,
        paid: inv.paidAmount,
        status: inv.status,
      }));
      return { success: true, data: (invoices as unknown) as T, statusCode: 200, isMock: true, emptyBody: false };
    }

    // Default mock response
    return {
      success: true,
      data: ({ message: 'Mock response successful', endpoint, method, timestamp: new Date().toISOString() } as unknown) as T,
      statusCode: 200,
      isMock: true,
      emptyBody: false,
    };
  }

  // --- Specific Documented Endpoint Implementations ---

  public async testConnection(): Promise<{ success: boolean; message: string; isMock: boolean }> {
    const config = db.getClasscardConfig();
    const isMock = isDemoMode && config.useMockMode;

    if (isMock) {
      return {
        success: true,
        message: 'Successfully verified Classcard API integration gateway.',
        isMock: true,
      };
    }
    // In live production mode, hit documented GET /students
    const res = await this.request<unknown[]>('/students', 'GET');
    if (res.success) {
      return {
        success: true,
        message: 'Successfully connected and authenticated with live Classcard Production Cloud API.',
        isMock: false,
      };
    }
    return {
      success: false,
      message: res.errorMessage || 'Failed to authenticate with live Classcard API.',
      isMock: false,
    };
  }

  // Students
  public async getStudents(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/students', 'GET');
  }

  public async addStudent(studentData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  }): Promise<ClasscardApiResponse<unknown>> {
    return this.request<unknown>('/students', 'POST', studentData);
  }

  public async getStudentEvents(studentId: string): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>(`/students/${studentId}/events`, 'GET');
  }

  public async getStudentByEmail(email: string): Promise<ClasscardApiResponse<unknown>> {
    return this.request<unknown>(`/students/search?email=${encodeURIComponent(email)}`, 'GET');
  }

  public async getStudentDetails(studentId: string, includeCustomFields = true): Promise<ClasscardApiResponse<unknown>> {
    const query = includeCustomFields ? '?include=custom_fields' : '';
    return this.request<unknown>(`/students/${studentId}${query}`, 'GET');
  }

  public async getStudentInvoices(studentId: string): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>(`/students/${studentId}/invoices`, 'GET');
  }

  // Staff
  public async getStaffList(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/staff', 'GET');
  }

  public async getStaffEvents(staffId: string): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>(`/staff/${staffId}/events`, 'GET');
  }

  public async getStaffServices(staffId: string): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>(`/staff/${staffId}/services`, 'GET');
  }

  // Events & Calendar
  public async getEvents(params?: { start?: string; end?: string }): Promise<ClasscardApiResponse<unknown[]>> {
    let query = '';
    if (params?.start && params?.end) {
      query = `?start=${encodeURIComponent(params.start)}&end=${encodeURIComponent(params.end)}`;
    }
    return this.request<unknown[]>(`/events${query}`, 'GET');
  }

  public async lateCancelEnrolment(enrolmentId: string): Promise<ClasscardApiResponse<unknown>> {
    return this.request<unknown>(`/enrolments/${enrolmentId}/late-cancel`, 'POST');
  }

  // Invoices & Payments
  public async getInvoices(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/invoices', 'GET');
  }

  public async getPayments(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/payments', 'GET');
  }

  // Attendance
  public async getAttendances(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/attendances', 'GET');
  }

  // Categories & Items
  public async getCategories(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/categories', 'GET');
  }

  public async getItems(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/items', 'GET');
  }

  // Guardians
  public async getGuardians(): Promise<ClasscardApiResponse<unknown[]>> {
    return this.request<unknown[]>('/guardians', 'GET');
  }
}

export const classcardClient = new ClasscardApiClient();
