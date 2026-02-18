import { Link } from "react-router-dom";

const RoleCard = ({ title, image, loginPath, registerPath }) => {
  return (
    <div className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full sm:w-72 text-center border border-white/20 transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:bg-white">

      {/* IMAGE CONTAINER */}
      <div className="relative mb-4 mx-auto w-24 h-24 flex items-center justify-center bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-300">
        <img
          src={image}
          alt={title}
          className="w-14 h-14 object-contain drop-shadow-md"
        />
      </div>

      <h2 className="text-2xl font-bold mb-5 text-gray-800 tracking-tight">{title}</h2>

      <div className="flex flex-col gap-2.5">
        <Link
          to={loginPath}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all duration-300 text-sm"
        >
          Login
        </Link>

        <Link
          to={registerPath}
          className="bg-white text-slate-700 font-semibold py-2.5 px-6 rounded-xl border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 shadow-sm text-sm"
        >
          Register
        </Link>
      </div>
    </div>
  );
};

export default RoleCard;

