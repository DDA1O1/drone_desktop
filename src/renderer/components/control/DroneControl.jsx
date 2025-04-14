import React from 'react';
import { useDispatch } from 'react-redux';
import { sendCommand } from '../../store/slices/droneSlice';

const DroneControl = () => {
    const dispatch = useDispatch();

    const handleCommand = (command) => {
        dispatch(sendCommand(command));
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-white">Flight Controls</h2>
            <div className="grid grid-cols-3 gap-4">
                {/* Takeoff/Land */}
                <div className="col-span-3 flex justify-center gap-4">
                    <button
                        onClick={() => handleCommand('takeoff')}
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
                    >
                        Take Off
                    </button>
                    <button
                        onClick={() => handleCommand('land')}
                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
                    >
                        Land
                    </button>
                </div>

                {/* Directional Controls */}
                <div className="col-span-3 grid grid-cols-3 gap-2">
                    {/* Up/Down */}
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={() => handleCommand('up 20')}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
                        >
                            Up
                        </button>
                        <button
                            onClick={() => handleCommand('down 20')}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
                        >
                            Down
                        </button>
                    </div>

                    {/* Forward/Backward */}
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={() => handleCommand('forward 20')}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
                        >
                            Forward
                        </button>
                        <button
                            onClick={() => handleCommand('back 20')}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
                        >
                            Back
                        </button>
                    </div>

                    {/* Left/Right */}
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={() => handleCommand('right 20')}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
                        >
                            Right
                        </button>
                        <button
                            onClick={() => handleCommand('left 20')}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
                        >
                            Left
                        </button>
                    </div>
                </div>

                {/* Emergency */}
                <div className="col-span-3 flex justify-center">
                    <button
                        onClick={() => handleCommand('emergency')}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                    >
                        Emergency Stop
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DroneControl;