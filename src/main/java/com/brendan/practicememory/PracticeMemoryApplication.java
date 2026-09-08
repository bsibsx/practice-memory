package com.brendan.practicememory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PracticeMemoryApplication {

    public static void main(String[] args) {
        SpringApplication.run(PracticeMemoryApplication.class, args);
    }
}
