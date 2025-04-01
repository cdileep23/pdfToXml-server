import jwt from 'jsonwebtoken'
const MiddlewareAuth=async(req,res,next)=>{
    try {
        const token=req.cookies.token;
        console.log("middle")
        console.log(token)
        if(!token){
            
    return res.status(401).json({
      success: false,
      message: "User Not Authenticated",
    });


        }

        const decode= jwt.verify(token,process.env.JWT_SECRET_KEY)
        if(!decode){
            return res.status(401).json({
                success: false,
                message: "Invalid Token",
              });
        }
req.id=decode.userId;

next()
    
        
    } catch (error) {
        console.log(error);
    return res.status(500).json({
      success: false,
      message: "failed to Read the User token",
    });
        
    }
}
export default MiddlewareAuth