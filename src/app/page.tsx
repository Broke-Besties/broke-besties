export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Group Management App</h1>
        <p className="text-gray-600 mb-8">Create groups, invite members, and collaborate</p>
        <div className="space-x-4">
          <a
            href="/signup"
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block"
          >
            Sign Up
          </a>
          <a
            href="/login"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 inline-block"
          >
            Log In
          </a>
        </div>
      </div>
    </div>
  );
}
