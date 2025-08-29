import { createContext , useState } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext()

const AppContextProvider =(props) => {

    const [user , setUser] = useState(null);


    const value = {
        user ,setUser
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}

        </AppContext.Provider>
    )

}


export default AppContextProvider
