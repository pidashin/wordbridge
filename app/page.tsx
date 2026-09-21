'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_USERS,
  CREATE_USER,
  DELETE_USER,
  GET_EXAM_HISTORY,
} from './gql/user';

const HistoryView = ({ userId }: { userId: string }) => {
  const { data, loading } = useQuery(GET_EXAM_HISTORY, {
    variables: { userId },
    fetchPolicy: 'cache-and-network',
  });

  if (loading)
    return <div className="text-gray-500 mt-4">Loading history...</div>;
  if (!data?.getExamHistory?.length)
    return (
      <div className="text-gray-500 text-sm mt-4">No exam history yet.</div>
    );

  return (
    <div className="mt-8 text-left w-full">
      <h3 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">
        Recent Exams
      </h3>
      <div className="max-h-64 overflow-y-auto rounded-md bg-gray-50 border border-gray-200">
        {data.getExamHistory.map(
          (h: {
            id: string;
            score: number;
            mode: string;
            createdAt: string;
          }) => (
            <div
              key={h.id}
              className="p-3 border-b border-gray-200 last:border-0 flex justify-between items-center"
            >
              <div>
                <span className="font-bold text-lg text-orange-600">
                  {h.score}
                </span>{' '}
                pts
                <span className="text-sm text-gray-500 ml-2 capitalize bg-gray-200 px-2 py-1 rounded">
                  ({h.mode})
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {new Date(h.createdAt).toLocaleDateString()}{' '}
                {new Date(h.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
};

const MainPage = () => {
  const { data, loading, refetch } = useQuery(GET_USERS);
  const [createUser] = useMutation(CREATE_USER);
  const [deleteUser] = useMutation(DELETE_USER);

  const [activeUser, setActiveUser] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    const savedUserId = localStorage.getItem('wordbridge_user_id');
    const savedUsername = localStorage.getItem('wordbridge_username');
    if (savedUserId && savedUsername) {
      setActiveUser({ id: savedUserId, username: savedUsername });
    }
  }, []);

  const handleSelectUser = (id: string, username: string) => {
    localStorage.setItem('wordbridge_user_id', id);
    localStorage.setItem('wordbridge_username', username);
    setActiveUser({ id, username });
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    try {
      const res = await createUser({
        variables: { username: newUsername.trim() },
      });
      const newUser = res.data.createUser;
      handleSelectUser(newUser.id, newUser.username);
      setNewUsername('');
      refetch();
    } catch (e) {
      console.error(e);
      alert('Failed to create user');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wordbridge_user_id');
    localStorage.removeItem('wordbridge_username');
    setActiveUser(null);
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the user "${username}"? All exam history for this user will be permanently deleted.`,
      )
    ) {
      return;
    }
    try {
      await deleteUser({
        variables: { id },
      });
      refetch();
    } catch (e) {
      console.error(e);
      alert('Failed to delete user');
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-orange-50">
        Loading...
      </div>
    );

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-orange-50"
      suppressHydrationWarning
    >
      <div className="text-center p-8 bg-white shadow-lg rounded-lg border border-orange-200 w-full max-w-md">
        <h1 className="text-4xl font-bold text-orange-600 mb-6">Word Bridge</h1>

        {activeUser ? (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold text-gray-700">
              Welcome, {activeUser.username}!
            </h2>
            <Link
              className="px-6 py-3 bg-orange-400 text-white font-semibold rounded-md hover:bg-orange-500 transition text-xl"
              href="/exam"
            >
              Start Exam
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 underline text-sm"
            >
              Switch User
            </button>
            <HistoryView userId={activeUser.id} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold text-gray-700">
              Who is playing?
            </h2>

            {data?.getUsers && data.getUsers.length > 0 && (
              <div className="flex flex-col gap-3">
                {data.getUsers.map((u: { id: string; username: string }) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-2 w-full group"
                  >
                    <button
                      onClick={() => handleSelectUser(u.id, u.username)}
                      className="flex-1 px-4 py-3 bg-blue-50 text-blue-800 font-semibold rounded-md hover:bg-blue-100 transition text-left"
                    >
                      {u.username}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUser(u.id, u.username);
                      }}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition duration-200"
                      title={`Delete ${u.username}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-lg text-gray-600 mb-3">Create New Player</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter name..."
                  className="flex-1 px-3 py-2 border rounded-md"
                />
                <button
                  onClick={handleCreateUser}
                  disabled={!newUsername.trim()}
                  className="px-4 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPage;
