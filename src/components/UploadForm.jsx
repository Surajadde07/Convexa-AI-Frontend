import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function UploadForm() {

    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);

    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");

    const handleUpload = async () => {

        if (!file) {
            alert("Please select an audio file");
            return;
        }

        try {

            setLoading(true);

            setLoadingText("Uploading Audio...");

            setTimeout(() => {
                setLoadingText("Generating Transcript...");
            }, 3000);

            setTimeout(() => {
                setLoadingText("Generating Summary...");
            }, 8000);

            setTimeout(() => {
                setLoadingText("Analyzing Sentiment...");
            }, 12000);

            const formData = new FormData();

            formData.append("audio", file);

            const response = await axios.post(
                "http://localhost:8080/api/calls/upload",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data"
                    }
                }
            );

            setResult(response.data);

        } catch (error) {

            console.error(error);

            alert("Upload failed");

        } finally {

            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6">

            {/* Navigation Buttons */}
            <div className="flex gap-4 mb-6">

                <Link
                    to="/history"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    View History
                </Link>

                <Link
                    to="/dashboard"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                    Dashboard
                </Link>

            </div>

            {/* Upload Card */}
            <div className="bg-white p-6 rounded-xl shadow">

                <h2 className="text-2xl font-bold mb-4">
                    Upload Call Recording
                </h2>

                <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="mb-4 block"
                />

                <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? "Processing..." : "Upload"}
                </button>

            </div>

            {/* Loading Section */}
            {loading && (

                <div className="mt-8 bg-white p-8 rounded-xl shadow text-center">

                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>

                    <h2 className="mt-4 text-xl font-semibold">
                        Processing Call...
                    </h2>

                    <p className="text-gray-600 mt-2">
                        {loadingText}
                    </p>

                </div>

            )}

            {/* Results */}
            {result && (

                <div className="mt-8 space-y-6">

                    <div className="bg-white p-5 rounded-xl shadow">
                        <h3 className="font-bold text-lg mb-2">
                            File Name
                        </h3>
                        <p>{result.fileName}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow">
                        <h3 className="font-bold text-lg mb-2">
                            Transcript
                        </h3>
                        <p>{result.transcript}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow">
                        <h3 className="font-bold text-lg mb-2">
                            Summary
                        </h3>
                        <p>{result.summary}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow">
                        <h3 className="font-bold text-lg mb-2">
                            Sentiment
                        </h3>
                        <p>{result.sentiment}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow">
                        <h3 className="font-bold text-lg mb-2">
                            Status
                        </h3>
                        <p>{result.status}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow">
                        <h3 className="font-bold text-lg mb-2">
                            AI Insights
                        </h3>

                        <pre className="whitespace-pre-wrap">
                            {result.insights}
                        </pre>
                    </div>

                </div>

            )}

        </div>
    );
}

export default UploadForm;