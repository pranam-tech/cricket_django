import { useEffect, useMemo, useState } from 'react';
import { authApi, getStoredToken, setAuthToken } from './api';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getStoredToken()));

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }

    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    setAuthToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await authApi.register(payload);
    setAuthToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Token may already be invalid; local cleanup is still enough.
    }
    setAuthToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await authApi.me();
    setUser(res.data);
    return res.data;
  };

  const value = useMemo(() => {
    const userType = user?.profile?.user_type ?? null;
    return {
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAuthenticated: Boolean(user),
      userType,
      isManager: ['manager', 'admin'].includes(userType),
      canScore: ['scorekeeper', 'admin'].includes(userType),
      canBrowse: Boolean(user),
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
