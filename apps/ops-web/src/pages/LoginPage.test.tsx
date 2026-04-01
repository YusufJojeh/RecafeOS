import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/context';
import { useAuthStore } from '../lib/auth-store';
import { LoginPage } from './LoginPage';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  consumeSessionReason: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  },
}));

import { apiFetch, ApiError, consumeSessionReason } from '../lib/api';

const mockApiFetch = vi.mocked(apiFetch);
const mockConsumeSessionReason = vi.mocked(consumeSessionReason);

function makeClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

function renderLogin() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <LanguageProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function renderLoginWithRoutes() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/floor" element={<div>floor-page</div>} />
            <Route path="/branch" element={<div>branch-page</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function fillSignInForm() {
  fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'user@test.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'secret123' } });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
    localStorage.clear();
    mockConsumeSessionReason.mockReturnValue(null);
  });

  it('renders sign-in form by default', () => {
    renderLogin();
    expect(screen.getByText('Staff access')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('shows invite toggle button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /Accept staff invite/i })).toBeInTheDocument();
  });

  it('switches to invite form when toggle clicked', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Accept staff invite/i }));
    expect(screen.getByLabelText(/Invite token/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept invite/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Email/i)).toBeNull();
  });

  it('switches back to sign-in form from invite form', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Accept staff invite/i }));
    fireEvent.click(screen.getByRole('button', { name: /Use email\/password sign-in/i }));
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Invite token/i)).toBeNull();
  });

  it('calls apiFetch with email and password on sign in', async () => {
    mockApiFetch.mockResolvedValueOnce({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      tenantId: 'ten_1',
      tenants: [{ id: 'ten_1', name: 'Org A', slug: 'org-a' }],
    });
    renderLogin();

    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledOnce());
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    const callArgs = mockApiFetch.mock.calls[0];
    const body = JSON.parse((callArgs[1] as RequestInit).body as string);
    expect(body.email).toBe('user@test.com');
    expect(body.password).toBe('secret123');
  });

  it('stores session on successful single-tenant login', async () => {
    mockApiFetch.mockResolvedValueOnce({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      tenantId: 'ten_1',
      tenants: [{ id: 'ten_1', name: 'Org A', slug: 'org-a' }],
    });
    renderLogin();
    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('tok_a'));
    expect(useAuthStore.getState().tenantId).toBe('ten_1');
  });

  it('shows tenant picker when multiple tenants returned', async () => {
    mockApiFetch.mockResolvedValueOnce({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      tenantId: 'ten_1',
      tenants: [
        { id: 'ten_1', name: 'Org A', slug: 'org-a' },
        { id: 'ten_2', name: 'Org B', slug: 'org-b' },
      ],
    });
    renderLogin();
    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Choose an organization to continue.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Org A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Org B/i })).toBeInTheDocument();
  });

  it('goes back from tenant picker on Back click', async () => {
    mockApiFetch.mockResolvedValueOnce({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      tenantId: 'ten_1',
      tenants: [
        { id: 'ten_1', name: 'Org A', slug: 'org-a' },
        { id: 'ten_2', name: 'Org B', slug: 'org-b' },
      ],
    });
    renderLogin();
    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => screen.getByRole('button', { name: /Back/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.queryByText('Choose an organization to continue.')).toBeNull();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('shows error message on login failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderLogin();
    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
  });

  it('shows a session expired message when recovery failed earlier', () => {
    mockConsumeSessionReason.mockReturnValueOnce('expired');
    renderLogin();

    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
  });

  it('formats 403 TENANT_SUSPENDED error with server message', async () => {
    mockApiFetch.mockRejectedValueOnce(
      new ApiError('forbidden', 403, { code: 'TENANT_SUSPENDED', message: 'Account suspended.' }),
    );
    renderLogin();
    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => expect(screen.getByText('Account suspended.')).toBeInTheDocument());
  });

  it('formats 403 TENANT_CANCELED with fallback when no message', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('forbidden', 403, { code: 'TENANT_CANCELED' }));
    renderLogin();
    fillSignInForm();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/Your organization cannot sign in right now/i)).toBeInTheDocument(),
    );
  });

  it('renders invite form fields', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Accept staff invite/i }));

    expect(screen.getByLabelText(/Invite token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password \(new or existing\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Display name/i)).toBeInTheDocument();
  });

  it('accepts invite and stores session', async () => {
    mockApiFetch.mockResolvedValueOnce({
      accessToken: 'invite_a',
      refreshToken: 'invite_r',
      tenantId: 'ten_2',
      tenants: [{ id: 'ten_2', name: 'Org B', slug: 'org-b' }],
    });
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Accept staff invite/i }));
    fireEvent.change(screen.getByLabelText(/Invite token/i), { target: { value: 'token-1' } });
    fireEvent.change(screen.getByLabelText(/Password \(new or existing\)/i), {
      target: { value: 'pw123456' },
    });
    fireEvent.change(screen.getByLabelText(/Display name/i), { target: { value: 'User Name' } });
    fireEvent.click(screen.getByRole('button', { name: /Accept invite/i }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('invite_a'));
  });

  it('shows invite error when invite acceptance fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Invite invalid'));
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Accept staff invite/i }));
    fireEvent.change(screen.getByLabelText(/Invite token/i), { target: { value: 'token-1' } });
    fireEvent.change(screen.getByLabelText(/Password \(new or existing\)/i), {
      target: { value: 'pw123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Accept invite/i }));
    expect(await screen.findByText(/Invite invalid/i)).toBeInTheDocument();
  });

  it('redirects authenticated users with branch to floor', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      refreshToken: 'ref',
      tenantId: 'ten',
      branchId: 'branch_1',
    });
    renderLoginWithRoutes();
    expect(await screen.findByText('floor-page')).toBeInTheDocument();
  });

  it('redirects authenticated users without branch to branch selector', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      refreshToken: 'ref',
      tenantId: 'ten',
      branchId: null,
    });
    renderLoginWithRoutes();
    expect(await screen.findByText('branch-page')).toBeInTheDocument();
  });
});
