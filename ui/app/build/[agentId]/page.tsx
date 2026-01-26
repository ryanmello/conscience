'use client';

import { useParams } from 'next/navigation';

export default function Agent() {
    const params = useParams();
    const agentId = params.agentId as string;

    return (
        <div>
            {agentId}
        </div>
    );
}
