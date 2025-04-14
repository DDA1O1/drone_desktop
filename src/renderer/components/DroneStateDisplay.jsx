import React from 'react';
import { useSelector } from 'react-redux';

const DroneStateDisplay = () => {
    const droneState = useSelector(state => state.drone);

    return (
        <div className="bg-gray-800 p-4 rounded-lg text-white">
            <h2 className="text-xl font-bold mb-4">Drone Telemetry</h2>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-gray-400">Battery</p>
                    <p className="text-lg">{droneState.battery}%</p>
                </div>
                <div>
                    <p className="text-gray-400">Height</p>
                    <p className="text-lg">{droneState.height}cm</p>
                </div>
                <div>
                    <p className="text-gray-400">Temperature</p>
                    <p className="text-lg">{droneState.temperature}°C</p>
                </div>
                <div>
                    <p className="text-gray-400">Status</p>
                    <p className="text-lg">{droneState.flying ? 'Flying' : 'Landed'}</p>
                </div>
                <div className="col-span-2">
                    <p className="text-gray-400">Speed</p>
                    <div className="grid grid-cols-3 gap-2">
                        <p>X: {droneState.speed.x}</p>
                        <p>Y: {droneState.speed.y}</p>
                        <p>Z: {droneState.speed.z}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DroneStateDisplay;