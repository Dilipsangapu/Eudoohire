package com.euodoo.hire.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * View controller for authentication and registration pages.
 */
@Controller
public class AuthController {

    /**
     * Login page view mapping.
     * Spring Security processes POST /auth/login.
     */
    @GetMapping("/auth/login")
    public String loginPage() {
        return "redirect:/login";
    }

    /**
     * Registration choice page.
     */
    @GetMapping("/auth/register")
    public String registerPage() {
        return "redirect:/register";
    }
}
