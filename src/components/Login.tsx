import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import logo from '../utils/A NT Logo2.png';

export default function Login() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const loginEmail = `${mobile}@login.local`;
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: loginEmail,
          password,
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          const { error: userError } = await supabase
            .from('users')
            .insert([{
              auth_user_id: authData.user.id,
              email: loginEmail,
              mobile: mobile,
              name: name || mobile,
              role: 'Admin',
              active: true,
            }]);

          if (userError) throw userError;

          setSuccess('Account created successfully! Please sign in.');
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { error } = await signIn(mobile, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md px-6 py-8">
        <div className="flex flex-col items-center mb-6">
          <img
            src={logo}
            alt="accountsNtax logo"
            className="h-32 w-auto object-contain"
          />
          <h1 className="-mt-8 text-2xl font-extrabold tracking-wide text-purple-700">
            INVENTO ERP
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="Your Name"
              />
            </div>
          )}

          <div>
            <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number
            </label>
            <input
              id="mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              placeholder="Enter mobile number"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
            {isSignUp && (
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>

          {/* <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div> */}
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Synced With Tally • Barcode Driven • Inventory Management
        </div>
      </div>
    </div>
  );
}
