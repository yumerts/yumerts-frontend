import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import { Modal, ModalBody, ModalContent, ModalHeader, ModalFooter, Button } from '@nextui-org/react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface GameWebsocketProviderType {
    gameWebsocket: WebSocket | null;
    connect: (match_id: number) => void;
    send: (data: string) => void;
    send_inputs: (input: any) => void,
    disconnect: () => void;
    onReceiveMessage: (callback: (message: MessageEvent) => void) => void;
}

const GameWebsocketContext = createContext<GameWebsocketProviderType | null>(null);

export const GameWebsocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameWebsocket, setGameWebsocket] = useState<WebSocket | null>(null);
    const [messageCallbacks, setMessageCallbacks] = useState<Array<(message: MessageEvent) => void>>([]);
    const [match_id, setMatchId] = useState(0);
    const {ready, wallets} = useWallets();
    const router = useRouter();

    const connect = (match_id: number) => {
        const websocketHost = process.env.NEXT_PUBLIC_GAME_SERVER_WEBSOCKET_HOST;
        if (!websocketHost) {
            console.error('WebSocket host is not defined');
            return;
        }
        
        const ws = new WebSocket(websocketHost);
        setMatchId(match_id);
        ws.onopen = () => {
            console.log('Connected to the websocket server')
            wallets[0].getEthersProvider().then(async provider => {
                let signer = provider.getSigner();
                ws.send(JSON.stringify({
                    type: "join_match",
                    match_id: match_id,
                    signature: await signer.signMessage(match_id.toString())
                }));
            })
        }

        ws.onmessage = (message) => {
            console.log(message)
            const parsedMessage = JSON.parse(message.data);
            let messageType = parsedMessage.type as string;

            if(messageType == "match_started"){
                //go to /gameplay 
                router.push('/gameplay');
            }

            if(messageType == "match_ended"){
                toast.success("Match Ended with Player " + parsedMessage.data.winner);
                router.push('/');
                ws.close();
            }
            messageCallbacks.forEach(callback => callback(parsedMessage));
            
            //messageCallbacks.forEach(callback => callback(message));
        };

        setGameWebsocket(ws);
    };

    const send = (data: string) => {
        if (gameWebsocket) {
            gameWebsocket.send(data);
        }
    };

    const send_inputs = (input: any) => {
        if (gameWebsocket) {

            let message = {
                type: "input",
                match_id: match_id,
                playerAddress: wallets[0].address,
                data: input
            }
            gameWebsocket.send(JSON.stringify(message));
        }
    };

    const disconnect = () => {
        if (gameWebsocket) {
            gameWebsocket.close();
        }
    };

    const onReceiveMessage = (callback: (message: MessageEvent) => void) => {
        setMessageCallbacks(prevCallbacks => [...prevCallbacks, callback]);
    };


    return (
        <GameWebsocketContext.Provider value={{ gameWebsocket, connect, send, send_inputs, disconnect, onReceiveMessage }}>
            {children}
        </GameWebsocketContext.Provider>
    );
};

export const useGameWebsocket = () => {
    const context = useContext(GameWebsocketContext);
    if (!context) {
        throw new Error('useGameWebsocket must be used within a GameWebsocketProvider');
    }
    return context;
}